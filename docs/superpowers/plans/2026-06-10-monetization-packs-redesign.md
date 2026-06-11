# MoodRx Monetization Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace subscription monetization with a one-time base unlock ($9.99) plus a per-pack ownership architecture, add free "programs," retire trial logic, and add pack-store scaffolding — all batched into one production build per platform.

**Architecture:** The single `premium` RevenueCat entitlement is now granted by a **non-consumable base-unlock product** instead of subscriptions. The `useSubscription()` boolean `isPremium` is **kept** (it already means "has the `premium` entitlement," which is exactly base-ownership now) — this avoids a high-risk rename across the many pure gating screens. The context gains `ownsPack(id)`, `purchaseBase()`, `purchasePack(id)` and loses all trial/monthly/yearly logic. Packs live in a separate `packs` RevenueCat offering (empty at launch). A future all-access subscription will grant a superset entitlement; `ownsPack` already checks for it via a `hasAllAccess` stub (always false at launch).

**Tech Stack:** Expo / React Native, `react-native-purchases` (RevenueCat), expo-router, AsyncStorage. **No test framework exists** — verification is `npm run typecheck` (`tsc --noEmit`) + `npm run lint` + manual dev-mode (`devTogglePremium`) and on-device checks. Introducing jest is deliberately out of scope (lean launch, one build).

**Key naming decision:** the exposed base-ownership boolean stays named `isPremium`. The spec referenced `ownsBase`; we satisfy its *intent* (base + pack ownership) while minimizing blast radius. Screens that only read `isPremium`/`isLoading` (`app/insights.tsx`, `app/home.tsx`, `app/prescription.tsx`, `lib/free-tier.ts`) need **no change**.

---

## File structure

**New files:**
- `lib/programs.ts` — program data (ordered existing-workout-id sequences + metadata) and lookup helpers.
- `app/programs.tsx` — programs list + per-program session list screen.
- `app/packs.tsx` — pack-store scaffolding screen (reads `packs` offering; empty state at launch).

**Modified files:**
- `lib/revenuecat.tsx` — add base/pack entitlement + package identifier constants.
- `contexts/SubscriptionContext.tsx` — refactor to ownership model; drop trial/sub logic.
- `components/PremiumSheet.tsx` — one-time unlock UI.
- `app/premium.tsx` — one-time unlock screen.
- `app/onboarding.tsx` — drop trial CTA; use base unlock.
- `app/settings.tsx` — remove trial UI; keep `isPremium`/restore/devToggle.
- `app/supplements.tsx` — drop `isInTrial`.
- `lib/notifications.ts` — remove `scheduleTrialNudges` + caller.
- `lib/subscription.ts` — remove trial-anchor helpers + stale product ids.

**Unchanged (verified):** `app/insights.tsx`, `app/home.tsx`, `app/prescription.tsx`, `lib/free-tier.ts`.

---

## Task 1: Entitlement & package identifiers

**Files:**
- Modify: `lib/revenuecat.tsx`

- [ ] **Step 1: Add identifier constants**

In `lib/revenuecat.tsx`, below the existing `REVENUECAT_ENTITLEMENT_IDENTIFIER` line, add:

```ts
export const REVENUECAT_ENTITLEMENT_IDENTIFIER = 'premium'; // base unlock (non-consumable)

/** RevenueCat package identifier for the one-time base unlock, in the
 *  `default` offering. ($rc_lifetime is RevenueCat's reserved package
 *  slot for a non-consumable/lifetime product.) */
export const BASE_UNLOCK_PACKAGE_ID = '$rc_lifetime';

/** Offering that holds purchasable content packs (empty at launch). */
export const PACKS_OFFERING_ID = 'packs';

/** Entitlement granted by a future all-access subscription. Checked by
 *  ownsPack() so adding the sub later needs no consumer changes. */
export const ALL_ACCESS_ENTITLEMENT_IDENTIFIER = 'all_access';

/** Per-pack entitlements are namespaced `pack_<id>`. */
export function packEntitlementId(packId: string): string {
  return `pack_${packId}`;
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/revenuecat.tsx
git commit -m "feat(iap): add base-unlock + pack entitlement identifiers"
```

---

## Task 2: Refactor SubscriptionContext to an ownership model

**Files:**
- Modify: `contexts/SubscriptionContext.tsx`

This is the core change. Replace the file's logic with the version below. It keeps `isPremium`, `isLoading`, `offerings`, `restorePurchases`, `devTogglePremium`, and the dev confirm-modal; it **removes** trial state (`isInTrial`, `trialDaysLeft`, `hasUsedTrial`, `startTrial`, `purchaseMonthly`, `purchaseYearly`) and all trial-eligibility/nudge code; it **adds** `ownsPack`, `purchaseBase`, `purchasePack`.

- [ ] **Step 1: Replace imports and helpers**

At the top of `contexts/SubscriptionContext.tsx`, replace the `react-native-purchases` import block and the `@/lib/revenuecat` / `@/lib/subscription` / notifications imports with:

```tsx
import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
} from 'react-native-purchases';
import {
  REVENUECAT_ENTITLEMENT_IDENTIFIER,
  ALL_ACCESS_ENTITLEMENT_IDENTIFIER,
  BASE_UNLOCK_PACKAGE_ID,
  PACKS_OFFERING_ID,
  packEntitlementId,
} from '@/lib/revenuecat';
import { colors } from '@/lib/colors';
```

Delete the now-unused imports: `INTRO_ELIGIBILITY_STATUS`, `hasLegacyTrialAnchor`, `setTrialNudgeAnchor`, `scheduleTrialNudges`. Delete the helper functions `deriveSubscriptionState`, `checkTrialUsedFromRC`, `maybeScheduleTrialNudges`, and the `SubscriptionSnapshot` interface.

- [ ] **Step 2: Replace the context value interface**

Replace `SubscriptionContextValue` with:

```tsx
interface SubscriptionContextValue {
  /** True when the user holds the `premium` entitlement (owns the base unlock). */
  isPremium: boolean;
  /** True when the user owns the given pack (or has all-access). */
  ownsPack: (packId: string) => boolean;
  isLoading: boolean;
  offerings: PurchasesOfferings | null;
  /** Resolves true when the base unlock was actually granted. */
  purchaseBase: () => Promise<boolean>;
  /** Resolves true when the given pack was actually granted. */
  purchasePack: (packId: string) => Promise<boolean>;
  restorePurchases: () => Promise<void>;
  devTogglePremium: () => void;
}
```

- [ ] **Step 3: Replace provider state + customer-info handling**

Replace the provider's state declarations and `applyCustomerInfo` with:

```tsx
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPaidPremium, setIsPaidPremium] = useState(false);
  const [ownedEntitlements, setOwnedEntitlements] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const pendingPurchaseRef = useRef<PurchasesPackage | null>(null);
  const pendingResolveRef = useRef<((granted: boolean) => void) | null>(null);
  const pendingGrantsRef = useRef<string | null>(null); // dev: entitlement to mock-grant

  const isPremium = isPaidPremium;

  const applyCustomerInfo = useCallback((customerInfo: CustomerInfo) => {
    const active = customerInfo.entitlements.active;
    setIsPaidPremium(active[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined);
    setOwnedEntitlements(new Set(Object.keys(active)));
  }, []);

  const ownsPack = useCallback(
    (packId: string): boolean =>
      ownedEntitlements.has(packEntitlementId(packId)) ||
      ownedEntitlements.has(ALL_ACCESS_ENTITLEMENT_IDENTIFIER),
    [ownedEntitlements],
  );
```

- [ ] **Step 4: Replace the init effect**

Replace the `useEffect`/`init` block with (drops the legacy-trial-anchor read and eligibility seeding):

```tsx
  useEffect(() => {
    let mounted = true;
    const onCustomerInfoUpdate = (info: CustomerInfo) => {
      if (mounted) applyCustomerInfo(info);
    };

    async function init() {
      try {
        const [customerInfo, rcOfferings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);
        if (mounted) {
          setOfferings(rcOfferings);
          applyCustomerInfo(customerInfo);
        }
        Purchases.addCustomerInfoUpdateListener(onCustomerInfoUpdate);
      } catch (err: unknown) {
        console.warn('SubscriptionContext init error:', isRCPurchaseError(err) ? err.message : String(err));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    init();

    return () => {
      mounted = false;
      Purchases.removeCustomerInfoUpdateListener(onCustomerInfoUpdate);
    };
  }, [applyCustomerInfo]);
```

- [ ] **Step 5: Replace purchase methods**

Replace `executePurchase`, `triggerPurchase`, `purchaseMonthly`, `purchaseYearly`, `startTrial` with `executePurchase`, `triggerPurchase`, `purchaseBase`, `purchasePack`. `executePurchase` keeps the same body but returns whether ANY new entitlement was granted; `triggerPurchase` takes a package + offering source:

```tsx
  const executePurchase = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      applyCustomerInfo(customerInfo);
      return Object.keys(customerInfo.entitlements.active).length > 0;
    } catch (err: unknown) {
      if (isRCPurchaseError(err) && err.userCancelled) return false;
      const msg = isRCPurchaseError(err) ? (err.message ?? 'Something went wrong.') : 'Something went wrong.';
      Alert.alert('Purchase failed', msg);
      return false;
    }
  }, [applyCustomerInfo]);

  const triggerPurchase = useCallback(
    async (pkg: PurchasesPackage | null | undefined, mockEntitlement: string): Promise<boolean> => {
      if (__DEV__) {
        return new Promise<boolean>((resolve) => {
          pendingPurchaseRef.current = pkg ?? null;
          pendingResolveRef.current = resolve;
          pendingGrantsRef.current = mockEntitlement;
          setConfirmVisible(true);
        });
      }
      if (Platform.OS === 'web') {
        Alert.alert('Unavailable', 'Purchases are only available in the iOS and Android apps.');
        return false;
      }
      if (!pkg) {
        Alert.alert('Unavailable', 'This item is not available right now. Please try again later.');
        return false;
      }
      return executePurchase(pkg);
    },
    [executePurchase],
  );

  const purchaseBase = useCallback((): Promise<boolean> => {
    const pkg = offerings?.current?.availablePackages?.find(
      (p) => p.identifier === BASE_UNLOCK_PACKAGE_ID,
    );
    return triggerPurchase(pkg, REVENUECAT_ENTITLEMENT_IDENTIFIER);
  }, [offerings, triggerPurchase]);

  const purchasePack = useCallback((packId: string): Promise<boolean> => {
    const pkg = offerings?.all?.[PACKS_OFFERING_ID]?.availablePackages?.find(
      (p) => p.identifier === packId,
    );
    return triggerPurchase(pkg, packEntitlementId(packId));
  }, [offerings, triggerPurchase]);
```

- [ ] **Step 6: Update dev toggle, restore, confirm handlers**

`devTogglePremium` stays (toggles `isPaidPremium`). In `restorePurchases`, replace the success message logic so it checks the `premium` entitlement (unchanged) but drops "subscription" wording:

```tsx
      if (hasEntitlement) {
        Alert.alert('Restored', 'Your MoodRx Pro purchase has been restored.');
      } else {
        Alert.alert('No purchases found', 'No previous MoodRx Pro purchase was found.');
      }
```

In `handleConfirmPurchase`, replace the dev mock-unlock branch (no real package) with one that grants the pending entitlement set:

```tsx
    } else {
      // Dev/preview: no real package — mock-grant the pending entitlement.
      const ent = pendingGrantsRef.current;
      if (ent === REVENUECAT_ENTITLEMENT_IDENTIFIER) setIsPaidPremium(true);
      if (ent) setOwnedEntitlements((prev) => new Set(prev).add(ent));
      resolve?.(true);
    }
```

Clear `pendingGrantsRef.current = null` in both `handleConfirmPurchase` and `handleCancelPurchase` alongside the existing ref clears. Remove the `await setTrialNudgeAnchor`/`scheduleTrialNudges` calls from the mock branch.

- [ ] **Step 7: Update the memoized value + `useSubscription` return**

Replace the `useMemo` value object and its dependency array to expose: `isPremium, ownsPack, isLoading, offerings, purchaseBase, purchasePack, restorePurchases, devTogglePremium`. The dev confirm `<Modal>` JSX stays unchanged.

- [ ] **Step 8: Verify**

Run: `npm run typecheck`
Expected: errors ONLY in the consumer files that still reference removed fields (`app/premium.tsx`, `app/settings.tsx`, `app/supplements.tsx`, `app/onboarding.tsx`, `components/PremiumSheet.tsx`). Those are fixed in Tasks 3–4. No errors inside `SubscriptionContext.tsx` itself.

- [ ] **Step 9: Commit**

```bash
git add contexts/SubscriptionContext.tsx
git commit -m "refactor(iap): ownership model (base + packs), drop trial/sub logic"
```

---

## Task 3: Rewrite the paywall UIs (PremiumSheet + premium screen)

**Files:**
- Modify: `components/PremiumSheet.tsx`
- Modify: `app/premium.tsx`

- [ ] **Step 1: Rewrite PremiumSheet to one-time unlock**

In `components/PremiumSheet.tsx`: change the context hook to `const { purchaseBase, offerings } = useSubscription();`. Compute the base price:

```tsx
const basePkg = offerings?.current?.availablePackages?.find((p) => p.identifier === '$rc_lifetime');
const basePrice = basePkg?.product?.priceString ?? '$9.99';
```

Remove the `!hasUsedTrial` trial button, the `trialNote`/`trialLabel` block, the yearly/monthly buttons, and the `subDisclosure` auto-renew paragraph. Replace the action area with a single unlock button (keep the legal links row — Terms + Privacy):

```tsx
<TouchableOpacity
  style={styles.yearlyButton}
  onPress={async () => { await purchaseBase(); onClose(); }}
  activeOpacity={0.8}
  accessibilityRole="button"
  accessibilityLabel={`Unlock MoodRx Pro, ${basePrice} one time`}
>
  <Text style={styles.planPrice}>UNLOCK MOODRX PRO — {basePrice}</Text>
  <Text style={styles.planSub}>One-time purchase. Yours forever.</Text>
</TouchableOpacity>
```

Replace the `subDisclosure` text with a one-time (non-auto-renew) line: `One-time purchase — no subscription, no auto-renew.` Keep the Terms/Privacy `legalLinksRow` and the NOT NOW close button. Remove now-unused styles (`trialButton`, `trialButtonText`, `trialNote`, `trialLabel`, `monthlyButton`, `monthlyPrice`).

- [ ] **Step 2: Rewrite app/premium.tsx to one-time unlock**

In `app/premium.tsx`: change the hook to `const { purchaseBase, restorePurchases, isPremium, offerings, isLoading: subLoading } = useSubscription();`. Delete `isInTrial`, `trialDaysLeft`, `hasUsedTrial`, `purchaseMonthly`, `purchaseYearly`, the `trialExpired` const, the `monthlyPkg`/`yearlyPkg`/`monthlyPrice`/`yearlyPrice` lines. Add:

```tsx
const basePkg = offerings?.current?.availablePackages?.find((p) => p.identifier === '$rc_lifetime');
const basePrice = basePkg?.product?.priceString ?? '$9.99';
```

Replace the trial/yearly/monthly badges and the entire `{!isPremium || isInTrial ? (...) : null}` block with: an owned badge when `isPremium`, otherwise a single unlock CTA:

```tsx
{isPremium ? (
  <View style={styles.statusBadge}>
    <Text style={styles.statusBadgeText}>YOU HAVE PRO</Text>
  </View>
) : (
  <TouchableOpacity
    style={styles.ctaButton}
    onPress={purchaseBase}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityLabel={`Unlock MoodRx Pro, ${basePrice} one time`}
  >
    <Text style={styles.ctaText}>UNLOCK MOODRX PRO — {basePrice} →</Text>
  </TouchableOpacity>
)}
```

Replace the `legalDisclosure` auto-renew paragraph with: `One-time purchase of {basePrice}. No subscription, no auto-renew. Payment is charged to your App Store or Google Play account at confirmation.` Keep the Terms/Privacy links and Restore Purchases button. Remove now-unused styles (`trialBadge`, `trialBadgeText`, `expiredBadge`, `expiredBadgeText`, `trialButton`, `trialButtonText`, `pricingLabel`, `yearlyCard`, `bestValueBadge`, `bestValueText`, `yearlyPrice`, `yearlyPer`, `yearlySub`, `monthlyCard`, `monthlyPrice`, `monthlyPer`, `cancelNote`). Keep `FEATURES` and the social-proof box.

- [ ] **Step 3: Verify**

Run: `npm run typecheck` then `npm run lint`
Expected: no errors in `components/PremiumSheet.tsx` or `app/premium.tsx` (lint must be clean — remove unused vars/styles).

- [ ] **Step 4: Commit**

```bash
git add components/PremiumSheet.tsx app/premium.tsx
git commit -m "feat(paywall): one-time base-unlock UI; remove trial/sub plans"
```

---

## Task 4: Update remaining consumers + remove trial machinery

**Files:**
- Modify: `app/onboarding.tsx`, `app/settings.tsx`, `app/supplements.tsx`
- Modify: `lib/notifications.ts`, `lib/subscription.ts`

- [ ] **Step 1: onboarding.tsx**

Change `const { purchaseYearly, hasUsedTrial } = useSubscription();` → `const { purchaseBase } = useSubscription();`. Replace the `purchaseYearly()` call (in the granted handler) with `purchaseBase()`. Replace the `{!hasUsedTrial ? (...) : (...)}` trial CTA with a single base-unlock CTA using the same button styles; change "START 7-DAY FREE TRIAL" copy to "UNLOCK MOODRX PRO". (Read the file first; the trial branch is around line 142.)

- [ ] **Step 2: supplements.tsx**

Change `const { isPremium, isInTrial, isLoading: subLoading } = useSubscription();` → `const { isPremium, isLoading: subLoading } = useSubscription();`. Change `const canUseReminder = !subLoading && (isPremium || isInTrial);` → `const canUseReminder = !subLoading && isPremium;`.

- [ ] **Step 3: settings.tsx**

Change the hook to `const { restorePurchases, isPremium, devTogglePremium, isLoading: subLoading } = useSubscription();` (drop `isInTrial`, `trialDaysLeft`, `hasUsedTrial`). Delete the `trialExpired` and `showFreeVersionCTA` consts and any trial-day UI (the `isInTrial` block around line 353 and the `trialDaysLeft` text). Keep the `{isPremium && !isInTrial && ...}` blocks but simplify the condition to `{isPremium && ...}` (lines ~344, 691). For the non-premium CTA, show a simple "Unlock MoodRx Pro" link to `/premium` regardless of trial history. (Read the file first; trial UI spans ~318–360 and ~691.)

- [ ] **Step 4: Remove trial nudges in notifications.ts**

Delete the `scheduleTrialNudges` function (around lines 402–434) and its call site (around line 463). Remove any now-unused imports it relied on (e.g. the trial-anchor getter). Run `npm run typecheck` to surface any dangling references and fix them.

- [ ] **Step 5: Clean up subscription.ts**

In `lib/subscription.ts`, delete the stale `PRODUCT_IDS` export (ids `moodrx_monthly_699`/`moodrx_yearly_4999` are unused and wrong) and the trial-anchor helpers `setTrialNudgeAnchor`, `getTrialNudgeAnchorMs`, `hasLegacyTrialAnchor` if no longer referenced after Step 4. Keep `clearTrial`/`setPremiumStatus` only if still referenced (check with grep); otherwise delete. Run `npm run typecheck` to confirm nothing dangles.

- [ ] **Step 6: Verify**

Run: `npm run typecheck` then `npm run lint`
Expected: clean across the whole project — all references to removed trial/sub fields are gone.

- [ ] **Step 7: Commit**

```bash
git add app/onboarding.tsx app/settings.tsx app/supplements.tsx lib/notifications.ts lib/subscription.ts
git commit -m "refactor(iap): retire trial machinery across consumers"
```

---

## Task 5: Programs feature (the launch depth win)

**Files:**
- Create: `lib/programs.ts`
- Create: `app/programs.tsx`
- Modify: `app/insights.tsx` (add a Programs entry button)

- [ ] **Step 1: Create lib/programs.ts**

```ts
import { getWorkoutById, type Workout } from '@/lib/workouts';

export interface Program {
  id: string;
  title: string;
  description: string;
  workoutIds: string[];
}

/** Curated sequences of existing workouts. Free within the base unlock. */
export const PROGRAMS: Program[] = [
  {
    id: 'reset-week',
    title: 'Reset Week',
    description: 'Seven days to pull yourself back to baseline — one prescription a day, across the moods you actually cycle through.',
    workoutIds: ['anxious-1', 'low-3', 'foggy-3', 'restless-3', 'stressed-2', 'good-3', 'anxious-2'],
  },
  {
    id: 'calm-fast',
    title: 'Calm Down Fast',
    description: 'A three-session sequence for when the anxiety and stress are stacking up and you need off the ledge today.',
    workoutIds: ['anxious-1', 'stressed-1', 'anxious-2'],
  },
];

export function getProgramById(id: string): Program | undefined {
  return PROGRAMS.find((p) => p.id === id);
}

export function getProgramWorkouts(program: Program): Workout[] {
  return program.workoutIds
    .map((id) => getWorkoutById(id))
    .filter((w): w is Workout => w !== undefined);
}
```

- [ ] **Step 2: Verify the program workout ids resolve**

Run: `npm run typecheck`
Expected: no errors. (All referenced ids exist in `lib/workouts.ts`: `anxious-1/2`, `low-3`, `foggy-3`, `restless-3`, `stressed-1/2`, `good-3`.)

- [ ] **Step 3: Create app/programs.tsx**

A screen that lists `PROGRAMS`; tapping a program expands its session list; tapping a session navigates to the existing workout route. Use the existing dark styling patterns from `app/insights.tsx` (colors `#0a0a0a` bg, mono labels). Gate: read `const { isPremium } = useSubscription();` and, if not premium, show the `PremiumSheet` on tap (programs are part of the base unlock). Each session row navigates with:

```tsx
router.push({ pathname: '/workout', params: { mood: workout.mood, workoutId: workout.id, intensity: '5' } });
```

Include a back button to `/insights` and register the route is automatic via expo-router file naming.

- [ ] **Step 4: Add a Programs entry on the Insights screen**

In `app/insights.tsx`, directly after the existing Supplement Tracker button (around line 262), add a sibling button following the exact same `styles.supplementBtn` pattern:

```tsx
<TouchableOpacity
  style={styles.supplementBtn}
  onPress={() => (isPremium ? router.push('/programs') : setShowPremiumSheet(true))}
  activeOpacity={0.7}
  accessibilityRole="button"
  accessibilityLabel={isPremium ? 'Open programs' : 'Unlock programs with Pro'}
>
  <Text style={styles.supplementBtnText}>
    {isPremium ? 'PROGRAMS →' : 'PROGRAMS [PRO] →'}
  </Text>
</TouchableOpacity>
```

(`isPremium`, `router`, `setShowPremiumSheet`, and `styles.supplementBtn` already exist in this file — no new imports.)

- [ ] **Step 5: Verify**

Run: `npm run typecheck` then `npm run lint`
Expected: clean. Then manual: in dev, `devTogglePremium` on, open Insights → Programs → tap a session → confirm it launches the correct workout.

- [ ] **Step 6: Commit**

```bash
git add lib/programs.ts app/programs.tsx app/insights.tsx
git commit -m "feat(programs): curated workout sequences (base-unlock content)"
```

---

## Task 6: Pack-store scaffolding

**Files:**
- Create: `app/packs.tsx`
- Modify: `app/premium.tsx` (link to packs from the Pro screen)

- [ ] **Step 1: Create app/packs.tsx**

A screen that reads the `packs` offering and renders pack cards; at launch the offering is empty, so it renders a "coming soon" empty state. Pattern:

```tsx
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PACKS_OFFERING_ID } from '@/lib/revenuecat';
// ...
const { offerings, ownsPack, purchasePack } = useSubscription();
const packs = offerings?.all?.[PACKS_OFFERING_ID]?.availablePackages ?? [];
```

If `packs.length === 0`, show: headline "Packs" + body "New MoodRx packs are coming soon — guided audio, focused programs, and more." For each pack (future), render title/price + a buy button calling `purchasePack(pkg.identifier)`, or an "OWNED" badge when `ownsPack(pkg.identifier)`. Use the dark styling patterns. Back button to `/premium`.

- [ ] **Step 2: Link to packs from the Pro screen**

In `app/premium.tsx`, add a row below the unlock CTA: a `TouchableOpacity` (reuse `styles.restoreButton`/`restoreText` styling) labeled `BROWSE PACKS →` that does `router.push('/packs')`.

- [ ] **Step 3: Verify**

Run: `npm run typecheck` then `npm run lint`
Expected: clean. Manual: open Pro → Browse Packs → confirm empty "coming soon" state renders.

- [ ] **Step 4: Commit**

```bash
git add app/packs.tsx app/premium.tsx
git commit -m "feat(packs): pack-store scaffolding (empty offering at launch)"
```

---

## Task 7: Store + RevenueCat configuration (manual — no code)

These are console steps; nothing to commit. Do them before the build's purchase test.

- [ ] **Step 1: App Store Connect** — create a **non-consumable** in-app purchase, product id `moodrx_pro_lifetime`, price tier **$9.99**, localized name "MoodRx Pro" + description, review screenshot (reuse the paywall screenshot). The first IAP must be attached to the app version and submitted *with* the binary. Delete or leave inactive the `moodrx_pro_monthly`/`moodrx_pro_yearly` subscriptions.

- [ ] **Step 2: Google Play** — create a one-time **in-app product**, id `moodrx_pro_lifetime`, price **$9.99**. Leave the existing subscriptions in place but unused.

- [ ] **Step 3: RevenueCat** — add both `moodrx_pro_lifetime` products; in the `default` offering, attach them to the `$rc_lifetime` package; ensure the package's products grant the `premium` entitlement. Create an empty `packs` offering for future use. Remove the subscription packages from `default` (or point `default` at a new offering that contains only `$rc_lifetime`).

- [ ] **Step 4: Reviewer access** — the old `MOODRXREVIEW` *subscription* promo code no longer unlocks anything. Recreate a reviewer unlock for the **one-time product** (Play: Promotions → "One-time product" promo code for `moodrx_pro_lifetime`). Update App access → Sign in details when the new code exists.

---

## Task 8: Build, verify, and gate launch

- [ ] **Step 1: Full static gate**

Run: `npm run typecheck` then `npm run lint`
Expected: both clean across the project.

- [ ] **Step 2: Dev runtime smoke test**

In dev (RevenueCat test store), confirm: Insights/home/prescription gating still works via `devTogglePremium`; PremiumSheet and `/premium` show the one-time unlock (no trial/monthly/yearly); Programs open when premium; Packs shows the empty state; no trial-nudge notifications get scheduled.

- [ ] **Step 3: Decide the build moment**

This is the single batched production build per platform (EAS credits constrained). Confirm the working tree is committed (`eas.json` has `requireCommit: true`). Build:

```bash
eas build --profile production --platform android
eas build --profile production --platform ios
```

(Run the two free pre-flight checks first: `eas build:version:get`, `eas env:list`.)

- [ ] **Step 4: On-device purchase verification**

Install the builds; redeem the new one-time reviewer code / use a sandbox account; confirm `moodrx_pro_lifetime` purchase grants `premium`, unlocks the gated features, and that Restore works. Verify on both platforms.

- [ ] **Step 5: Exclude EU at availability** (per `eu-distribution-deferred`) and proceed with the rest of the launch checklist (Health Connect video, Data Safety already done, submission).

---

## Notes for the implementer
- `app/insights.tsx`, `app/home.tsx`, `app/prescription.tsx`, `lib/free-tier.ts` intentionally need **no changes** — they read only `isPremium`/`isLoading`, whose meaning is unchanged.
- Keep commits small (one per task/step group) — `requireCommit: true` means the build uses committed state.
- Do NOT add a test framework; verification is typecheck + lint + manual, by design for this lean launch.
