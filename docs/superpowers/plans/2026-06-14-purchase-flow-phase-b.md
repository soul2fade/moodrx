# Purchase-Flow Phase B (Consistency) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Pro lock and upsell speak with one voice — a canonical offer line, a single dimmed "price-on-the-lock" chip, and one shared offer sheet that carries the proof into the decision.

**Architecture:** Add a pure, unit-tested copy module (`lib/offer-copy.ts`) holding the canonical strings, contextual headlines, and base-price selection. Extract the proof box from `app/premium.tsx` into a shared `<OfferProof>` so the sheet can carry it. Upgrade `<PremiumSheet>` to take a `context` prop (contextual headline + canonical reassurance + proof + Phase-A buttons + Restore/Maybe-later footer). Add a shared `<PriceChip>` and replace the grab-bag of lock treatments ("UNLOCK PRO →", "[PRO]", "+N MORE PATTERNS", "UNLOCK →") across `programs`, `insights`, `prescription`, `supplements`, `home`, `settings`.

**Tech Stack:** React Native (Expo Router), TypeScript, vitest. No pricing/product/gating changes (those are Phases C–E). JS-only — verifiable on the local debug build + Metro reload (see `local-build-verification` memory). Builds on Phase A's `usePurchaseButton` + `lib/purchase-ui.ts`, already merged on this branch.

**Scope note:** This plan changes COPY and PRESENTATION only. The free-tier rules in `lib/free-tier.ts` and all entitlement checks are untouched. Per spec §6, `app/packs.tsx` is already consistent (owned/BUY + spinner) and is out of scope.

---

## File Structure

- **Create** `lib/offer-copy.ts` — canonical copy, `offerHeadline(context)`, `chipLabel(price)`, `selectBasePrice(offerings)`. Pure, no RN imports (vitest-safe).
- **Create** `lib/__tests__/offer-copy.test.ts` — unit tests for the above.
- **Create** `components/OfferProof.tsx` — the "−3 / your avg shift" proof box, extracted from `premium.tsx`, reused in the sheet.
- **Create** `components/PriceChip.tsx` — one dimmed price chip used at every lock.
- **Modify** `components/PremiumSheet.tsx` — `context` prop → contextual headline, canonical reassurance, proof carried in, Restore + Maybe-later footer.
- **Modify** `app/premium.tsx` — use `<OfferProof>` and `selectBasePrice`; canonical reassurance copy.
- **Modify** `app/programs.tsx`, `app/insights.tsx`, `app/prescription.tsx`, `app/supplements.tsx`, `app/home.tsx`, `app/settings.tsx` — replace lock treatments with `<PriceChip>` / canonical copy and pass a `context` to the sheet.

---

## Task 1: Canonical copy module (pure, TDD)

**Files:**
- Create: `lib/offer-copy.ts`
- Test: `lib/__tests__/offer-copy.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/__tests__/offer-copy.test.ts
import { describe, it, expect } from 'vitest';
import {
  CANONICAL_OFFER_LINE,
  CANONICAL_REASSURANCE,
  offerHeadline,
  chipLabel,
  selectBasePrice,
} from '@/lib/offer-copy';

describe('canonical copy', () => {
  it('exposes the one offer line, verbatim', () => {
    expect(CANONICAL_OFFER_LINE).toBe('Unlock everything — $9.99 once. No subscription.');
  });
  it('exposes the canonical reassurance, verbatim', () => {
    expect(CANONICAL_REASSURANCE).toBe('$9.99 once · no subscription · yours forever');
  });
});

describe('offerHeadline', () => {
  it('returns a contextual headline per entry point', () => {
    expect(offerHeadline('workouts')).toBe('Unlock all 18 workouts');
    expect(offerHeadline('patterns')).toBe('See your full patterns');
    expect(offerHeadline('supplements')).toBe('Unlock the supplement tracker');
    expect(offerHeadline('programs')).toBe('Unlock programs');
    expect(offerHeadline('calendar')).toBe('See your progress over time');
    expect(offerHeadline('history')).toBe('See your full history');
    expect(offerHeadline('reminders')).toBe('Unlock daily reminders');
  });
  it('falls back to the generic headline', () => {
    expect(offerHeadline()).toBe('Unlock everything');
    expect(offerHeadline('default')).toBe('Unlock everything');
  });
});

describe('chipLabel', () => {
  it('puts the price on the lock', () => {
    expect(chipLabel('$9.99')).toBe('$9.99 unlocks this');
    expect(chipLabel('£8.99')).toBe('£8.99 unlocks this');
  });
});

describe('selectBasePrice', () => {
  const offerings = {
    current: { availablePackages: [{ identifier: '$rc_lifetime', product: { priceString: '$9.99' } }] },
  };
  it('reads the base unlock price string from offerings', () => {
    expect(selectBasePrice(offerings)).toBe('$9.99');
  });
  it('falls back to $9.99 when offerings are missing', () => {
    expect(selectBasePrice(null)).toBe('$9.99');
    expect(selectBasePrice({ current: { availablePackages: [] } })).toBe('$9.99');
  });
  it('respects a custom fallback', () => {
    expect(selectBasePrice(undefined, '—')).toBe('—');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/offer-copy.test.ts`
Expected: FAIL — `Cannot find module '@/lib/offer-copy'`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/offer-copy.ts
/**
 * Canonical purchase copy — one offer, shown the same way everywhere (spec §2).
 * Pure module: NO react-native imports, so it stays vitest-safe.
 */

/** The one offer line, reused verbatim wherever the deal is described in prose. */
export const CANONICAL_OFFER_LINE = 'Unlock everything — $9.99 once. No subscription.';

/** The canonical reassurance line shown on/near every offer surface (spec §4). */
export const CANONICAL_REASSURANCE = '$9.99 once · no subscription · yours forever';

/** Entry points that open the offer sheet — each gets a contextual headline. */
export type OfferContext =
  | 'default'
  | 'workouts'
  | 'patterns'
  | 'history'
  | 'calendar'
  | 'supplements'
  | 'programs'
  | 'reminders';

const HEADLINES: Record<OfferContext, string> = {
  default: 'Unlock everything',
  workouts: 'Unlock all 18 workouts',
  patterns: 'See your full patterns',
  history: 'See your full history',
  calendar: 'See your progress over time',
  supplements: 'Unlock the supplement tracker',
  programs: 'Unlock programs',
  reminders: 'Unlock daily reminders',
};

export function offerHeadline(context: OfferContext = 'default'): string {
  return HEADLINES[context] ?? HEADLINES.default;
}

/** The price-on-the-lock chip label, e.g. "$9.99 unlocks this". */
export function chipLabel(price: string): string {
  return `${price} unlocks this`;
}

// Mirror of BASE_UNLOCK_PACKAGE_ID in lib/revenuecat.tsx. Inlined here so this
// module imports no react-native (revenuecat.tsx pulls in react-native-purchases,
// which would break the vitest node environment).
const BASE_UNLOCK_PACKAGE_ID = '$rc_lifetime';

interface PricedOfferings {
  current?: {
    availablePackages?: { identifier: string; product?: { priceString?: string } }[];
  } | null;
}

/** Reads the formatted base-unlock price from RevenueCat offerings. */
export function selectBasePrice(
  offerings: PricedOfferings | null | undefined,
  fallback = '$9.99',
): string {
  const pkg = offerings?.current?.availablePackages?.find(
    (p) => p.identifier === BASE_UNLOCK_PACKAGE_ID,
  );
  return pkg?.product?.priceString ?? fallback;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/offer-copy.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/offer-copy.ts lib/__tests__/offer-copy.test.ts
git commit -m "feat(purchase): canonical offer copy + contextual headlines (Phase B)"
```

---

## Task 2: Extract `<OfferProof>` and use it in premium.tsx

The proof box currently lives only on `app/premium.tsx` (lines ~118–130). The spec wants the same proof carried into the sheet, so extract it verbatim into a shared component.

**Files:**
- Create: `components/OfferProof.tsx`
- Modify: `app/premium.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/OfferProof.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSessions } from '@/contexts/SessionsContext';
import { formatSessionDelta } from '@/lib/session-utils';
import { type as t, fonts } from '@/lib/typography';

/**
 * The outcome-proof block: the user's own avg shift once they have ≥3 sessions,
 * otherwise the illustrative "−3" example. Shared by the premium screen and the
 * offer sheet so the proof lives where the decision happens (spec §4).
 */
export function OfferProof() {
  const { sessionCount, avgChange } = useSessions();
  const hasPersonalStats = sessionCount >= 3;
  const personalDeltaLabel = formatSessionDelta(5, 5 + Math.round(avgChange * 10) / 10);

  return (
    <View style={styles.box}>
      <Text style={styles.stat}>{hasPersonalStats ? personalDeltaLabel : '−3'}</Text>
      <Text style={styles.label}>
        {hasPersonalStats ? 'YOUR AVG SHIFT PER SESSION' : 'EXAMPLE SHIFT (ONE SESSION)'}
      </Text>
      <Text style={styles.sub}>
        {hasPersonalStats
          ? `Based on ${sessionCount} logged sessions in your evidence file.`
          : 'Log a few sessions to see your own average here.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderLeftWidth: 3,
    borderLeftColor: '#059669',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#0d0d0d',
  },
  stat: { fontSize: 36, fontWeight: '700', color: '#059669', fontFamily: fonts.mono.bold },
  label: { ...t.label, color: '#ffffff', letterSpacing: 2, fontSize: 16, lineHeight: 17, marginTop: 4 },
  sub: { ...t.label, color: '#ffffff', fontSize: 16, letterSpacing: 1, marginTop: 6, lineHeight: 16 },
});
```

- [ ] **Step 2: Replace the inline proof box in `app/premium.tsx`**

Find this block (≈ lines 118–130, the `socialProofBox` View):

```tsx
        <View style={styles.socialProofBox}>
          <Text style={styles.socialProofStat}>
            {hasPersonalStats ? personalDeltaLabel : '−3'}
          </Text>
          <Text style={styles.socialProofLabel}>
            {hasPersonalStats ? 'YOUR AVG SHIFT PER SESSION' : 'EXAMPLE SHIFT (ONE SESSION)'}
          </Text>
          <Text style={styles.socialProofSub}>
            {hasPersonalStats
              ? `Based on ${sessionCount} logged sessions in your evidence file.`
              : 'Log a few sessions to see your own average here.'}
          </Text>
        </View>
```

Replace with:

```tsx
        <OfferProof />
```

- [ ] **Step 3: Wire imports and drop now-dead code in `app/premium.tsx`**

Add the import near the other component imports:

```tsx
import { OfferProof } from '@/components/OfferProof';
```

Remove the now-unused `hasPersonalStats` and `personalDeltaLabel` consts, the `useSessions()` destructure (only used by those), the `formatSessionDelta` import, and the `socialProofBox/socialProofStat/socialProofLabel/socialProofSub` style entries. (TypeScript and `expo lint` will flag any that are still referenced — if `sessionCount`/`avgChange` are used elsewhere on the screen, keep them.)

- [ ] **Step 4: Verify typecheck + lint**

Run: `npm run typecheck && npx eslint app/premium.tsx components/OfferProof.tsx`
Expected: no errors (0 warnings from these files).

- [ ] **Step 5: Commit**

```bash
git add components/OfferProof.tsx app/premium.tsx
git commit -m "refactor(purchase): extract shared OfferProof from premium screen"
```

---

## Task 3: Upgrade `<PremiumSheet>` into the one offer sheet

Give the sheet a `context`, a contextual headline, the canonical reassurance, the proof, and a Restore + Maybe-later footer. Reuse Phase A's `usePurchaseButton` for Restore (the buy button is already wired from Phase A).

**Files:**
- Modify: `components/PremiumSheet.tsx`

- [ ] **Step 1: Update the props + header copy**

Change the interface and signature:

```tsx
interface PremiumSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Entry point — drives the contextual headline. */
  context?: OfferContext;
}

export function PremiumSheet({ visible, onClose, context = 'default' }: PremiumSheetProps) {
```

Add imports:

```tsx
import { useSubscription } from '@/contexts/SubscriptionContext';
import { usePurchaseButton } from '@/hooks/usePurchaseButton';
import { purchaseButtonLabel } from '@/lib/purchase-ui';
import { offerHeadline, selectBasePrice, CANONICAL_REASSURANCE, type OfferContext } from '@/lib/offer-copy';
import { OfferProof } from '@/components/OfferProof';
```

Replace the base-price computation with the shared selector and add a Restore controller (the `buyBtn` from Phase A stays):

```tsx
  const { purchaseBase, restorePurchases, offerings } = useSubscription();
  const basePrice = selectBasePrice(offerings);

  const buyBtn = usePurchaseButton({
    offeringsLoaded: !!offerings,
    run: purchaseBase,
    onSuccess: onClose, // flash "You're in ✓", then close — revealing unlocked content
  });
  const restoreBtn = usePurchaseButton({
    offeringsLoaded: true,
    run: restorePurchases,
    onSuccess: onClose,
  });
```

- [ ] **Step 2: Replace the headline/description/legal body**

Find the current headline + description:

```tsx
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.description}>{description}</Text>
```

Replace with the contextual headline + canonical reassurance + proof:

```tsx
        <Text style={styles.headline}>{offerHeadline(context)}</Text>
        <Text style={styles.description}>{CANONICAL_REASSURANCE}</Text>
        <OfferProof />
        <View style={{ height: 20 }} />
```

(The buy `<TouchableOpacity>` block from Phase A stays exactly as-is between this and the footer.)

- [ ] **Step 3: Replace the footer ("NOT NOW" → Restore + Maybe later)**

Find:

```tsx
        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Text style={styles.closeText}>NOT NOW</Text>
        </TouchableOpacity>
```

Replace with:

```tsx
        <View style={styles.footerRow}>
          <TouchableOpacity
            onPress={restoreBtn.onPress}
            disabled={restoreBtn.disabled}
            activeOpacity={0.7}
            style={styles.footerBtn}
            accessibilityRole="button"
            accessibilityState={{ disabled: restoreBtn.disabled, busy: restoreBtn.busy }}
            accessibilityLabel="Restore purchase"
          >
            {restoreBtn.busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.closeText}>
                {purchaseButtonLabel(restoreBtn.status, { idle: 'RESTORE PURCHASE', success: 'RESTORED ✓' })}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={styles.footerBtn}
            accessibilityRole="button"
            accessibilityLabel="Maybe later"
          >
            <Text style={styles.closeText}>MAYBE LATER</Text>
          </TouchableOpacity>
        </View>
```

Add `ActivityIndicator` to the `react-native` import if not already present, and add styles:

```tsx
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  footerBtn: { flex: 1, alignItems: 'center', paddingVertical: 8 },
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npx eslint components/PremiumSheet.tsx`
Expected: no errors. (Removing the `headline`/`description` props is intentional — Task 6/7 stop passing them.)

- [ ] **Step 5: Commit**

```bash
git add components/PremiumSheet.tsx
git commit -m "feat(purchase): one offer sheet — contextual headline, proof, restore footer"
```

---

## Task 4: Shared `<PriceChip>`

**Files:**
- Create: `components/PriceChip.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/PriceChip.tsx
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { selectBasePrice, chipLabel } from '@/lib/offer-copy';
import { type as t } from '@/lib/typography';
import { colors } from '@/lib/colors';

/**
 * The one locked-state affordance (spec §6): a small dimmed chip that always
 * shows the price on the lock and opens the offer sheet. `label` overrides the
 * default "$X unlocks this" for context (e.g. "$9.99 unlocks all 18").
 */
export function PriceChip({
  onPress,
  label,
  accessibilityLabel,
}: {
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
}) {
  const { offerings } = useSubscription();
  const text = label ?? chipLabel(selectBasePrice(offerings));
  return (
    <Pressable
      onPress={onPress}
      style={styles.chip}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? text}
    >
      <Text style={styles.chipText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.premium,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  chipText: { ...t.label, color: colors.premium, letterSpacing: 1.5 },
});
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npx eslint components/PriceChip.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/PriceChip.tsx
git commit -m "feat(purchase): shared PriceChip lock affordance"
```

---

## Task 5: programs.tsx — chip + context

**Files:**
- Modify: `app/programs.tsx`

- [ ] **Step 1: Replace the locked state**

Find (≈ lines 46–59):

```tsx
        {!isPremium ? (
          /* Safety-net locked state */
          <View style={styles.lockedState}>
            <Text style={styles.lockedText}>Programs are included with your base unlock.</Text>
            <TouchableOpacity
              style={styles.unlockBtn}
              onPress={() => setShowPremiumSheet(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Unlock programs"
            >
              <Text style={styles.unlockBtnText}>UNLOCK →</Text>
            </TouchableOpacity>
          </View>
        ) : (
```

Replace with:

```tsx
        {!isPremium ? (
          /* Safety-net locked state */
          <View style={styles.lockedState}>
            <Text style={styles.lockedText}>Curated multi-day sequences, included with the base unlock.</Text>
            <PriceChip
              onPress={() => setShowPremiumSheet(true)}
              accessibilityLabel="Unlock programs"
            />
          </View>
        ) : (
```

- [ ] **Step 2: Pass context to the sheet + import the chip**

Add import:

```tsx
import { PriceChip } from '@/components/PriceChip';
```

Change the sheet render (≈ line 67):

```tsx
      <PremiumSheet
        visible={showPremiumSheet}
        onClose={() => setShowPremiumSheet(false)}
        context="programs"
      />
```

Delete the now-unused `unlockBtn`/`unlockBtnText` styles (lint will confirm).

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck && npx eslint app/programs.tsx`

```bash
git add app/programs.tsx
git commit -m "feat(purchase): programs lock uses PriceChip + contextual sheet"
```

---

## Task 6: insights.tsx — calendar, upsell rows, buttons

**Files:**
- Modify: `app/insights.tsx`

- [ ] **Step 1: Import the chip**

```tsx
import { PriceChip } from '@/components/PriceChip';
```

- [ ] **Step 2: Calendar lock** — find (≈ 304–312):

```tsx
              <TouchableOpacity
                style={styles.lockedCalendarButton}
                onPress={() => setShowPremiumSheet(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Unlock Pro to see your calendar"
              >
                <Text style={styles.lockedCalendarButtonText}>UNLOCK PRO</Text>
              </TouchableOpacity>
```

Replace with:

```tsx
              <PriceChip
                onPress={() => setShowPremiumSheet(true)}
                accessibilityLabel="Unlock your progress calendar"
              />
```

- [ ] **Step 3: The four upsell rows.** Each currently uses `historyUpsellRow` + `historyUpsellText` with "… UNLOCK PRO →". Replace each `<TouchableOpacity>…</TouchableOpacity>` upsell with a labelled `<PriceChip>` that keeps its count. Apply to all four:

Patterns (≈ 405–417):

```tsx
            {!subLoading && !isPremium && lockedPatternCount > 0 && (
              <PriceChip
                onPress={() => setShowPremiumSheet(true)}
                label={`$9.99 unlocks +${lockedPatternCount} more ${lockedPatternCount === 1 ? 'pattern' : 'patterns'}`}
                accessibilityLabel={`See ${lockedPatternCount} more ${lockedPatternCount === 1 ? 'pattern' : 'patterns'}`}
              />
            )}
```

Workout history (≈ 472–484):

```tsx
            {!subLoading && !isPremium && workoutStats.total > 3 && (
              <PriceChip
                onPress={() => setShowPremiumSheet(true)}
                label={`$9.99 unlocks +${workoutStats.total - 3} more`}
                accessibilityLabel={`See all ${workoutStats.total - 3} more workouts`}
              />
            )}
```

Case history (≈ 526–538):

```tsx
            {!subLoading && !isPremium && sessionCount > 3 && (
              <PriceChip
                onPress={() => setShowPremiumSheet(true)}
                label={`$9.99 unlocks +${sessionCount - 3} more session${sessionCount - 3 === 1 ? '' : 's'}`}
                accessibilityLabel={`See all ${sessionCount - 3} more sessions`}
              />
            )}
```

Field notes (≈ 563–575):

```tsx
            {!subLoading && !isPremium && sessionNotes.total > 3 && (
              <PriceChip
                onPress={() => setShowPremiumSheet(true)}
                label={`$9.99 unlocks +${sessionNotes.total - 3} more notes`}
                accessibilityLabel={`See all ${sessionNotes.total - 3} more notes`}
              />
            )}
```

> The hard-coded `$9.99` in the labels matches the existing fallback copy; the chip's *default* (no `label`) reads the live price. Keeping these literal is acceptable for Phase B since `lib/free-tier.ts` strings are likewise literal. If the team prefers live price here too, thread `selectBasePrice(offerings)` in — but that's optional.

- [ ] **Step 4: Buttons "[PRO]" copy.** The Supplement Tracker (≈ 277–279) and Programs (≈ 290–292) button labels currently say "… [PRO] →". Replace the `[PRO]` treatment with the canonical price:

Supplement tracker:

```tsx
          <Text style={styles.supplementBtnText}>
            {isPremium ? 'SUPPLEMENT TRACKER →' : 'SUPPLEMENT TRACKER — $9.99 →'}
          </Text>
```

Programs:

```tsx
          <Text style={styles.supplementBtnText}>
            {isPremium ? 'PROGRAMS →' : 'PROGRAMS — $9.99 →'}
          </Text>
```

- [ ] **Step 5: Context on the sheet.** The insights screen serves several locks; use the broadest contextual headline. Find the `<PremiumSheet …>` render (≈ 650) and pass `context="patterns"` (insights is the "see your patterns/history" surface). Delete the now-unused `lockedCalendarButton`, `lockedCalendarButtonText`, `historyUpsellRow`, `historyUpsellText` styles (lint will confirm none remain referenced).

- [ ] **Step 6: Verify + commit**

Run: `npm run typecheck && npx eslint app/insights.tsx`

```bash
git add app/insights.tsx
git commit -m "feat(purchase): insights locks use PriceChip + canonical price"
```

---

## Task 7: prescription.tsx — workout alternatives + supplement stack

**Files:**
- Modify: `app/prescription.tsx`

- [ ] **Step 1: Import the chip**

```tsx
import { PriceChip } from '@/components/PriceChip';
```

- [ ] **Step 2: Locked workout alternative.** Find the inline label (≈ 250):

```tsx
                          <Text style={styles.unlockProText}>UNLOCK PRO →</Text>
```

Replace with:

```tsx
                          <PriceChip onPress={() => setShowPremiumSheet(true)} accessibilityLabel={`Unlock ${workout.name}`} />
```

(The surrounding card keeps its `opacity: 0.7` dim — that IS the "dimmed + chip" pattern.)

- [ ] **Step 3: Locked supplement row.** Find (≈ 324–326):

```tsx
                      {isLocked && (
                        <Text style={styles.unlockProTextStack}>UNLOCK PRO →</Text>
                      )}
```

Replace with:

```tsx
                      {isLocked && (
                        <PriceChip onPress={() => setShowPremiumSheet(true)} accessibilityLabel={`Unlock ${supp.name}`} />
                      )}
```

> The supplement row's `onPress` opens the detail modal; the chip's own `onPress` opens the sheet directly. `<Pressable>` inside a `<TouchableOpacity>` row: the chip handles its own tap, so the price-chip tap goes straight to the sheet while tapping elsewhere on the row still opens detail. Verify on-device that the inner chip tap wins (it does in RN — the inner Pressable consumes the touch).

- [ ] **Step 4: Context on the sheet** (≈ 349). The screen's primary lock is workouts:

```tsx
      <PremiumSheet
        visible={showPremiumSheet}
        onClose={() => setShowPremiumSheet(false)}
        context="workouts"
      />
```

Delete now-unused `unlockProText` / `unlockProTextStack` styles if no longer referenced (lint will confirm). Also check the supplement *detail modal* "UNLOCK FULL STACK WITH PRO →" button (search the file) — replace its label with `UNLOCK FULL STACK — $9.99 →` for consistency; leave its handler.

- [ ] **Step 5: Verify + commit**

Run: `npm run typecheck && npx eslint app/prescription.tsx`

```bash
git add app/prescription.tsx
git commit -m "feat(purchase): prescription locks use PriceChip + contextual sheet"
```

---

## Task 8: supplements.tsx — reminder lock gets a real CTA

The locked reminder card currently has NO way to upgrade. Add a chip + the shared sheet.

**Files:**
- Modify: `app/supplements.tsx`

- [ ] **Step 1: Imports + sheet state**

Add imports:

```tsx
import { PriceChip } from '@/components/PriceChip';
import { PremiumSheet } from '@/components/PremiumSheet';
```

Add state near the top of the component (next to the other `useState`s):

```tsx
  const [showPremiumSheet, setShowPremiumSheet] = useState(false);
```

- [ ] **Step 2: Replace the locked reminder card** (≈ 418–423):

```tsx
          ) : (
            <View style={[styles.reminderCard, styles.reminderCardLocked]}>
              <Text style={styles.reminderLabel}>DAILY REMINDER</Text>
              <Text style={styles.reminderLockedText}>Daily supplement reminders are part of the base unlock.</Text>
              <View style={{ height: 12 }} />
              <PriceChip onPress={() => setShowPremiumSheet(true)} accessibilityLabel="Unlock daily reminders" />
            </View>
          )}
```

- [ ] **Step 3: Render the sheet.** Find the screen's outermost closing tag (after the main `ScrollView`/container) and add before it:

```tsx
      <PremiumSheet
        visible={showPremiumSheet}
        onClose={() => setShowPremiumSheet(false)}
        context="reminders"
      />
```

- [ ] **Step 4: Verify + commit**

Run: `npm run typecheck && npx eslint app/supplements.tsx`

```bash
git add app/supplements.tsx
git commit -m "feat(purchase): supplement reminder lock gets PriceChip + sheet"
```

---

## Task 9: home.tsx + settings.tsx — canonical price on the entry chips

These are status/entry points (they route to `/premium`, not the sheet). Keep the routing; just put the price on the lock.

**Files:**
- Modify: `app/home.tsx`, `app/settings.tsx`

- [ ] **Step 1: home.tsx TRY PRO badge** (≈ 302):

```tsx
              <Text style={styles.tryProBadgeText}>UNLOCK — $9.99 →</Text>
```

(Leave the Pro badge and loading placeholder as-is.)

- [ ] **Step 2: settings.tsx upgrade button** (≈ 420):

```tsx
              <Text style={styles.upgradeBtnText}>UNLOCK — $9.99 →</Text>
```

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck && npx eslint app/home.tsx app/settings.tsx`

```bash
git add app/home.tsx app/settings.tsx
git commit -m "feat(purchase): price-on-the-lock copy for home + settings entries"
```

---

## Task 10: Full verification + manual checklist

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: all tests pass (Phase A's `purchase-ui` + new `offer-copy` included).

- [ ] **Step 2: Typecheck + lint the whole project**

Run: `npm run typecheck && npx eslint app/ lib/ components/ contexts/ hooks/`
Expected: 0 errors (the pre-existing `lib/micro-workout.ts` import/first warning is the only allowed warning).

- [ ] **Step 3: On-device manual checklist** (local debug build + Metro reload; use `devTogglePremium` to flip free/Pro):
  - Every lock shows a dimmed feature + a price chip with the price visible BEFORE any tap.
  - Tapping any chip opens the offer sheet with the right contextual headline, the canonical reassurance line, and the proof box.
  - The sheet's buy button still flashes "You're in ✓" then closes into the unlocked content (Phase A).
  - Restore in the footer shows its spinner → "RESTORED ✓".
  - No "UNLOCK PRO →", "[PRO]", "+N MORE … UNLOCK PRO →", or "UNLOCK →" strings remain (grep: `git grep -nE "UNLOCK PRO|\[PRO\]|UNLOCK →"` should only hit comments/tests, if any).

- [ ] **Step 4: Finish the branch** — use `superpowers:finishing-a-development-branch` to decide merge/PR.

---

## Self-Review

- **Spec coverage:** §2 canonical offer line + price-on-lock → Tasks 1, 4–9. §4 one offer sheet (contextual headline, reassurance, proof carried in, real-state button, restore/maybe-later footer) → Tasks 2, 3. §6 one locked-state everywhere → Tasks 5–9. Phase-A button states reused (not re-specced). MoodRx+ / voices à la carte explicitly deferred to C–E. ✓
- **Out of scope confirmed:** no `lib/free-tier.ts`, entitlement, RevenueCat product, or `app.json` changes. ✓
- **Type consistency:** `OfferContext` values (`default|workouts|patterns|history|calendar|supplements|programs|reminders`) match every `context=` usage in Tasks 3, 5–8. `selectBasePrice`/`chipLabel`/`offerHeadline` signatures match call sites. `PriceChip` prop set (`onPress`, `label?`, `accessibilityLabel?`) matches every render. ✓
- **Placeholder scan:** the only literal `$9.99`s are the insights upsell-row labels and home/settings entry chips, which intentionally mirror existing literal copy; flagged inline with the live-price alternative. ✓
