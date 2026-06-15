# MoodRx+ Foundation & Gating (Phase E1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MoodRx+ (`all_access`) mean full app access, and re-gate the live post-workout coach line behind it with a 3-reply free taste.

**Architecture:** A pure, unit-tested taste gate (`lib/live-coach.ts`) + persisted counter (`lib/storage.ts`). `SubscriptionContext` derives `isPremium = base OR all_access` and a new `isPlus = all_access`, with dev toggles. `app/post-workout.tsx` gates the live line on `isPlus || taste-remaining`. JS-only, mock-testable, no products.

**Tech Stack:** React Native (Expo), TypeScript, vitest, RevenueCat. No `app.json`/native changes. Builds on the existing `all_access` entitlement (`lib/revenuecat.tsx`) and dev mock-grant.

**Interim state (expected):** after E1, base owners get "3 live replies then stock line" with no upsell prompt — that sheet/products/soft-landing are E2. Branch not shippable until E2.

---

## File Structure

- **Create** `lib/live-coach.ts` — pure `canUseLiveCoach` + `LIVE_COACH_TASTE_LIMIT`. RN-free (vitest-safe).
- **Create** `lib/__tests__/live-coach.test.ts`.
- **Modify** `lib/storage.ts` — `getLiveCoachTasteUsed`/`incrementLiveCoachTasteUsed`/`resetLiveCoachTasteUsed`.
- **Modify** `contexts/SubscriptionContext.tsx` — `isPremium` = base OR all_access; add `isPlus`; add dev toggles `devTogglePlus`.
- **Modify** `app/post-workout.tsx` — gate the live line on `isPlus || taste`.
- **Modify** `app/settings.tsx` — dev panel (revealed by the existing version-tap) with toggle Pro / toggle Plus / reset taste.

---

## Task 1: Pure taste gate (TDD)

**Files:** Create `lib/live-coach.ts`, `lib/__tests__/live-coach.test.ts`.

- [ ] **Step 1: Failing test** — `lib/__tests__/live-coach.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { canUseLiveCoach, LIVE_COACH_TASTE_LIMIT } from '@/lib/live-coach';

describe('LIVE_COACH_TASTE_LIMIT', () => {
  it('is 3', () => {
    expect(LIVE_COACH_TASTE_LIMIT).toBe(3);
  });
});

describe('canUseLiveCoach', () => {
  it('MoodRx+ is always allowed, even past the limit', () => {
    expect(canUseLiveCoach({ isPlus: true, tasteUsed: 0 })).toBe(true);
    expect(canUseLiveCoach({ isPlus: true, tasteUsed: 99 })).toBe(true);
  });
  it('non-plus is allowed while taste remains', () => {
    expect(canUseLiveCoach({ isPlus: false, tasteUsed: 0 })).toBe(true);
    expect(canUseLiveCoach({ isPlus: false, tasteUsed: 2 })).toBe(true);
  });
  it('non-plus is blocked at/after the limit', () => {
    expect(canUseLiveCoach({ isPlus: false, tasteUsed: 3 })).toBe(false);
    expect(canUseLiveCoach({ isPlus: false, tasteUsed: 4 })).toBe(false);
  });
  it('honors a custom limit', () => {
    expect(canUseLiveCoach({ isPlus: false, tasteUsed: 1, tasteLimit: 1 })).toBe(false);
    expect(canUseLiveCoach({ isPlus: false, tasteUsed: 0, tasteLimit: 1 })).toBe(true);
  });
});
```

- [ ] **Step 2: Run, confirm FAIL** — `npx vitest run lib/__tests__/live-coach.test.ts` → "Cannot find module '@/lib/live-coach'".

- [ ] **Step 3: Implement** — `lib/live-coach.ts`:

```typescript
/** Live (Anthropic-backed) Dr. MoodRx coach gating. Pure — no react-native. */

/** Free lifetime live-coach replies a non-MoodRx+ owner gets before the upsell. */
export const LIVE_COACH_TASTE_LIMIT = 3;

/** Whether a live coach line may be fetched: MoodRx+ always; otherwise while the
 *  free lifetime taste remains. */
export function canUseLiveCoach({
  isPlus,
  tasteUsed,
  tasteLimit = LIVE_COACH_TASTE_LIMIT,
}: {
  isPlus: boolean;
  tasteUsed: number;
  tasteLimit?: number;
}): boolean {
  if (isPlus) return true;
  return tasteUsed < tasteLimit;
}
```

- [ ] **Step 4: Run, confirm PASS** — `npx vitest run lib/__tests__/live-coach.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/live-coach.ts lib/__tests__/live-coach.test.ts
git commit -m "feat(coach): pure live-coach taste gate (canUseLiveCoach + limit)"
```

---

## Task 2: Taste counter storage

**Files:** Modify `lib/storage.ts`.

- [ ] **Step 1: Add helpers** — append near the other simple getters (follow the existing key + try/catch pattern, e.g. `TRASH_TALK_VOLUME`):

```typescript
const LIVE_COACH_TASTE_KEY = '@moodrx_live_coach_taste_used';

/** How many free live-coach replies a non-MoodRx+ owner has consumed (lifetime). */
export async function getLiveCoachTasteUsed(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(LIVE_COACH_TASTE_KEY);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function incrementLiveCoachTasteUsed(): Promise<void> {
  try {
    const current = await getLiveCoachTasteUsed();
    await AsyncStorage.setItem(LIVE_COACH_TASTE_KEY, String(current + 1));
  } catch {
    // non-critical
  }
}

/** Dev/testing: reset the consumed-taste counter to 0. */
export async function resetLiveCoachTasteUsed(): Promise<void> {
  try {
    await AsyncStorage.setItem(LIVE_COACH_TASTE_KEY, '0');
  } catch {
    // non-critical
  }
}
```

- [ ] **Step 2: Verify** — `npm run typecheck && npx eslint lib/storage.ts` (clean).

- [ ] **Step 3: Commit**

```bash
git add lib/storage.ts
git commit -m "feat(coach): persist live-coach taste counter"
```

---

## Task 3: Entitlement model — isPremium = base OR all_access; add isPlus

**Files:** Modify `contexts/SubscriptionContext.tsx`.

- [ ] **Step 1: Derive full-access + plus** — replace the line `const isPremium = isPaidPremium;` with:

```tsx
  const hasAllAccess = ownedEntitlements.has(ALL_ACCESS_ENTITLEMENT_IDENTIFIER);
  // Full app access = owns the base unlock OR has MoodRx+ (all_access). So a
  // MoodRx+ trial/subscriber unlocks everything the base does.
  const isPremium = isPaidPremium || hasAllAccess;
  // MoodRx+ specifically — gates the live coach.
  const isPlus = hasAllAccess;
```

(`ALL_ACCESS_ENTITLEMENT_IDENTIFIER` is already imported; `ownedEntitlements` state is declared above this line.)

- [ ] **Step 2: Interface** — in `interface SubscriptionContextValue`, after the `isPremium` line add:

```tsx
  /** True when MoodRx+ (all_access) is active — gates the live AI coach. */
  isPlus: boolean;
```

and after the `devTogglePremium: () => void;` line add:

```tsx
  /** Dev-only: toggle the all_access (MoodRx+) entitlement. */
  devTogglePlus: () => void;
```

- [ ] **Step 3: dev toggle** — directly after the existing `devTogglePremium` useCallback add:

```tsx
  const devTogglePlus = useCallback(() => {
    if (!__DEV__) return;
    setOwnedEntitlements((prev) => {
      const next = new Set(prev);
      if (next.has(ALL_ACCESS_ENTITLEMENT_IDENTIFIER)) next.delete(ALL_ACCESS_ENTITLEMENT_IDENTIFIER);
      else next.add(ALL_ACCESS_ENTITLEMENT_IDENTIFIER);
      return next;
    });
  }, []);
```

- [ ] **Step 4: Expose** — add `isPlus` and `devTogglePlus` to the `useMemo` value object AND its dependency array (place `isPlus` near `isPremium`, `devTogglePlus` near `devTogglePremium`).

- [ ] **Step 5: Verify** — `npm run typecheck && npx eslint contexts/SubscriptionContext.tsx && npm test` (all clean/passing; additive — existing consumers of `isPremium` now also unlock under all_access, which is intended).

- [ ] **Step 6: Commit**

```bash
git add contexts/SubscriptionContext.tsx
git commit -m "feat(plus): isPremium honors all_access; add isPlus + dev toggle"
```

---

## Task 4: Re-gate the live coach line (post-workout)

**Files:** Modify `app/post-workout.tsx`.

- [ ] **Step 1: Imports** — add to the `@/lib/storage` import the names `getLiveCoachTasteUsed, incrementLiveCoachTasteUsed`, and add:

```tsx
import { canUseLiveCoach } from '@/lib/live-coach';
```

- [ ] **Step 2: Use isPlus** — change the subscription destructure at line ~63 from `const { isPremium } = useSubscription();` to `const { isPlus } = useSubscription();` (confirm `isPremium` is not used elsewhere in this file — it is only used in the effect below; grep to be sure).

- [ ] **Step 3: Gate + consume taste** — replace the effect body (lines ~112–128):

```tsx
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enabled = await getAiCoachEnabled();
      if (!enabled || postInsult === '') return;
      const tasteUsed = await getLiveCoachTasteUsed();
      if (!canUseLiveCoach({ isPlus, tasteUsed })) return; // out of taste → keep stock line
      const sessions = await getSessions();
      const context = buildCoachContext({ mood, intensity, workout }, sessions);
      const line = await fetchDynamicLine(context);
      if (cancelled || !line) return;
      setDynamicLine(line);
      if (!isPlus) await incrementLiveCoachTasteUsed(); // a consumed free taste
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mood/intensity/workout are mount-fixed route params; postInsult/isPlus gate the live fetch
  }, [postInsult, isPlus]);
```

- [ ] **Step 4: Verify** — `npm run typecheck && npx eslint app/post-workout.tsx && npm test` (clean/passing). Confirm no leftover `isPremium` reference in the file.

- [ ] **Step 5: Commit**

```bash
git add app/post-workout.tsx
git commit -m "feat(coach): gate live post-workout line on MoodRx+ or the 3-reply taste"
```

---

## Task 5: Dev panel to test the states

**Files:** Modify `app/settings.tsx`.

Context: `settings.tsx` already has a hidden gesture — tapping the version text 5× calls `devTogglePremium()` (search for `versionTapCount` / `devTogglePremium`). Extend this into a small visible dev panel so all three states are testable on device.

- [ ] **Step 1: Read** the version-tap block and the `useSubscription()` destructure in `settings.tsx`.

- [ ] **Step 2: Wire** — add `devTogglePlus` to the `useSubscription()` destructure (alongside the existing `devTogglePremium`), and import `resetLiveCoachTasteUsed` from `@/lib/storage`. Add a `const [devPanel, setDevPanel] = useState(false);` near the other state. Change the 5-tap handler to `setDevPanel(true)` (reveal the panel) instead of calling `devTogglePremium()` directly.

- [ ] **Step 3: Render the panel** — when `__DEV__ && devPanel`, render a small block (place it in the Pro section). Use plain inline buttons consistent with the file's existing button styles:

```tsx
        {__DEV__ && devPanel && (
          <View style={{ marginTop: 12, gap: 8 }}>
            <TouchableOpacity onPress={devTogglePremium} accessibilityRole="button" style={styles.upgradeBtn}>
              <Text style={styles.upgradeBtnText}>DEV: TOGGLE BASE (PRO)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={devTogglePlus} accessibilityRole="button" style={styles.upgradeBtn}>
              <Text style={styles.upgradeBtnText}>DEV: TOGGLE MOODRX+ (PLUS)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { void resetLiveCoachTasteUsed(); }} accessibilityRole="button" style={styles.upgradeBtn}>
              <Text style={styles.upgradeBtnText}>DEV: RESET COACH TASTE</Text>
            </TouchableOpacity>
          </View>
        )}
```

(Reuse `styles.upgradeBtn`/`styles.upgradeBtnText` — they already exist. If `View`/`useState` aren't imported in settings, they are — it's a screen.)

- [ ] **Step 4: Verify** — `npm run typecheck && npx eslint app/settings.tsx && npm test` (clean/passing).

- [ ] **Step 5: Commit**

```bash
git add app/settings.tsx
git commit -m "chore(dev): settings dev panel — toggle base/plus + reset coach taste"
```

---

## Task 6: Full verification

- [ ] `npm test` — all pass (incl. new `live-coach` suite).
- [ ] `npm run typecheck` — clean.
- [ ] `npx eslint app/ lib/ components/ contexts/ hooks/` — 0 errors (the pre-existing `lib/micro-workout.ts` warning is the only allowed warning).
- [ ] On-device (local debug, dev panel): toggle Plus → live coach every workout, no counter movement, base features unlocked. Toggle Base only → live coach for 3 post-workouts then the stock line; "reset coach taste" re-enables it. Final reviewer pass over the E1 diff.

---

## Self-Review

- **Spec coverage:** §2 entitlement model (isPremium = base OR all_access; isPlus) → Task 3. §3 pure gate + storage + post-workout wiring → Tasks 1, 2, 4. §4 testing + dev tooling → Tasks 1, 5, 6. ✓
- **Scope:** no products, no upsell sheet, no soft-landing, no secondary entries (all E2); vent untouched. ✓
- **Placeholder scan:** Task 5 references the existing `versionTapCount`/`devTogglePremium` mechanism and `styles.upgradeBtn*` — instruction is to read + extend, with the panel JSX given in full. No TBDs. ✓
- **Type consistency:** `canUseLiveCoach({ isPlus, tasteUsed, tasteLimit? })`, `LIVE_COACH_TASTE_LIMIT`, `getLiveCoachTasteUsed`/`incrementLiveCoachTasteUsed`/`resetLiveCoachTasteUsed`, context `isPlus`/`devTogglePlus` — names consistent across Tasks 1–5. ✓
