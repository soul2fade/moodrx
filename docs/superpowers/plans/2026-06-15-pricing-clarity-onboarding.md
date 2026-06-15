# Pricing clarity + coach bundling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MoodRx's pricing surprise-free — disclose all three tiers (Free / Own it $9.99 / MoodRx+) up front in a two-tile onboarding carousel, and fold the à la carte coach voices into MoodRx+ (removing every à la carte buy surface).

**Architecture:** A new pure data module (`lib/pricing-tiers.ts`) holds the canonical 3-tier feature matrix; a presentational `PricingComparison` component renders it with tier colors. Onboarding becomes a 2-page horizontal pager (how-it-works → pricing + CTAs). Voices unlock only via the existing `all_access` entitlement, so the à la carte purchase paths (`purchaseVoice`/`purchasePack`/`ownsPack`, the voice picker buy buttons, the packs store) are deleted.

**Tech Stack:** React Native (Expo), TypeScript, vitest, RevenueCat (`react-native-purchases`). JS-only — verifies on the local debug build over Metro, no EAS build. RevenueCat catalog already grants voices via `all_access` (no store changes needed).

**Spec:** [docs/superpowers/specs/2026-06-15-pricing-clarity-onboarding-design.md](../specs/2026-06-15-pricing-clarity-onboarding-design.md)

---

## File structure

**Create:**
- `lib/pricing-tiers.ts` — tier metadata + feature matrix (pure data + helpers).
- `lib/__tests__/pricing-tiers.test.ts` — matrix consistency tests.
- `components/PricingComparison.tsx` — 3-column comparison UI.

**Modify:**
- `lib/colors.ts` — add `tierOwn` / `tierPlus` tokens.
- `components/PlusSheet.tsx` — add optional `onPurchased` callback.
- `app/onboarding.tsx` — 2-tile carousel + pricing tile + 3 CTAs.
- `components/VoiceSheet.tsx` — remove buy/bundle; reframe copy; locked → PlusSheet.
- `components/CoachVoicePicker.tsx` — remove à la carte wiring; slim props.
- `contexts/SubscriptionContext.tsx` — remove `purchaseVoice` / `purchasePack` / `ownsPack`.
- `app/premium.tsx` — remove the `/packs` button.
- `lib/revenuecat.tsx` — remove `PACKS_OFFERING_ID` / `VOICE_PACK_ID` / `packEntitlementId`.

**Delete:**
- `app/packs.tsx` — the à la carte content store.

---

## Task 1: Tier color tokens

**Files:**
- Modify: `lib/colors.ts`

- [ ] **Step 1: Add tier tokens.** In `lib/colors.ts`, inside the exported `colors` object, after the `premium: '#E8B84B',` line add:

```ts
  // Pricing-tier accents (used only by the pricing comparison). Mirror the mood
  // palette: Own it = foggy blue, MoodRx+ = good green, Free = plain white.
  tierFree: '#ffffff',
  tierOwn: '#5EAAB5',   // === colors.info / mood 'foggy'
  tierPlus: '#059669',  // === colors.success / mood 'good'
```

- [ ] **Step 2: Verify typecheck.**

Run: `npm run typecheck`
Expected: PASS (no output errors).

- [ ] **Step 3: Commit.**

```bash
git add lib/colors.ts
git commit -m "feat(pricing): add tier color tokens (own=blue, plus=green)"
```

---

## Task 2: Pricing-tiers data module (TDD)

**Files:**
- Create: `lib/pricing-tiers.ts`
- Test: `lib/__tests__/pricing-tiers.test.ts`

- [ ] **Step 1: Write the failing test.** Create `lib/__tests__/pricing-tiers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PRICING_TIERS, PRICING_FEATURES, tierValue } from '@/lib/pricing-tiers';

describe('pricing tiers', () => {
  it('has exactly free, own, plus in order', () => {
    expect(PRICING_TIERS.map((t) => t.key)).toEqual(['free', 'own', 'plus']);
  });

  it('is monotonic: free ⊆ own ⊆ plus for every feature', () => {
    for (const f of PRICING_FEATURES) {
      if (f.free) expect(f.own).toBe(true);
      if (f.own) expect(f.plus).toBe(true);
    }
  });

  it('AI-layer features are MoodRx+ only', () => {
    const aiOnly = ['Live Dr. MoodRx AI coach', 'Every coach personality', 'New content packs'];
    for (const label of aiOnly) {
      const f = PRICING_FEATURES.find((x) => x.label === label);
      expect(f, label).toBeDefined();
      expect(f!.free).toBe(false);
      expect(f!.own).toBe(false);
      expect(f!.plus).toBe(true);
    }
  });

  it('baseline features are in every tier', () => {
    const everyone = ['Mood check-ins + coach Rachel', 'Top workout + weekly bonus', "Today's supplement pick"];
    for (const label of everyone) {
      const f = PRICING_FEATURES.find((x) => x.label === label);
      expect(f, label).toBeDefined();
      expect([f!.free, f!.own, f!.plus]).toEqual([true, true, true]);
    }
  });

  it('tierValue reads the right column', () => {
    const f = PRICING_FEATURES[0];
    expect(tierValue(f, 'free')).toBe(f.free);
    expect(tierValue(f, 'own')).toBe(f.own);
    expect(tierValue(f, 'plus')).toBe(f.plus);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npm test -- pricing-tiers`
Expected: FAIL — cannot find module `@/lib/pricing-tiers`.

- [ ] **Step 3: Implement the module.** Create `lib/pricing-tiers.ts`:

```ts
import { colors } from '@/lib/colors';

export type TierKey = 'free' | 'own' | 'plus';

export interface PricingTier {
  key: TierKey;
  name: string;
  /** Fallback display price; live prices override at render time. */
  price: string;
  /** Short terms line shown under the column. */
  terms: string;
  color: string;
}

export interface PricingFeature {
  label: string;
  free: boolean;
  own: boolean;
  plus: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  { key: 'free', name: 'Free',    price: '$0',       terms: 'free forever', color: colors.tierFree },
  { key: 'own',  name: 'Own it',  price: '$9.99',    terms: 'one-time',     color: colors.tierOwn },
  { key: 'plus', name: 'MoodRx+', price: '$3.99/mo', terms: '7 days free',  color: colors.tierPlus },
];

// Canonical feature matrix. Mirrors the real gating: workouts + supplements use
// lib/free-tier.ts (free gets the top pick + weekly bonus / first supplement),
// the rest gate on isPremium, and the AI layer gates on isPlus. Keep in sync —
// the test enforces monotonicity and the AI-only / everyone rows.
export const PRICING_FEATURES: PricingFeature[] = [
  { label: 'Mood check-ins + coach Rachel',       free: true,  own: true,  plus: true },
  { label: 'Top workout + weekly bonus',          free: true,  own: true,  plus: true },
  { label: "Today's supplement pick",             free: true,  own: true,  plus: true },
  { label: 'All 18 workouts, every mood',         free: false, own: true,  plus: true },
  { label: 'Full supplement tracker + reminders', free: false, own: true,  plus: true },
  { label: 'Full history, patterns, calendar',    free: false, own: true,  plus: true },
  { label: 'Live Dr. MoodRx AI coach',            free: false, own: false, plus: true },
  { label: 'Every coach personality',             free: false, own: false, plus: true },
  { label: 'New content packs',                   free: false, own: false, plus: true },
];

export function tierValue(feature: PricingFeature, key: TierKey): boolean {
  return feature[key];
}
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `npm test -- pricing-tiers`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit.**

```bash
git add lib/pricing-tiers.ts lib/__tests__/pricing-tiers.test.ts
git commit -m "feat(pricing): canonical 3-tier feature matrix + tests"
```

---

## Task 3: PricingComparison component

**Files:**
- Create: `components/PricingComparison.tsx`

- [ ] **Step 1: Implement the component.** Create `components/PricingComparison.tsx`:

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PRICING_TIERS, PRICING_FEATURES, tierValue, type TierKey } from '@/lib/pricing-tiers';
import { fonts } from '@/lib/typography';

interface Props {
  /** Live price overrides keyed by tier; falls back to PRICING_TIERS defaults. */
  prices?: Partial<Record<TierKey, string>>;
}

export function PricingComparison({ prices }: Props) {
  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel="Pricing comparison">
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.featureCol} />
        {PRICING_TIERS.map((t) => (
          <View key={t.key} style={styles.tierCol}>
            <Text style={[styles.tierName, { color: t.color }]} numberOfLines={1}>{t.name}</Text>
            <Text style={styles.tierPrice} numberOfLines={1}>{prices?.[t.key] ?? t.price}</Text>
          </View>
        ))}
      </View>

      {PRICING_FEATURES.map((f) => (
        <View key={f.label} style={styles.featureRow}>
          <Text style={styles.featureLabel}>{f.label}</Text>
          {PRICING_TIERS.map((t) => {
            const included = tierValue(f, t.key);
            return (
              <View key={t.key} style={styles.tierCol}>
                <Text
                  style={[styles.cell, { color: included ? t.color : '#55554f' }]}
                  accessibilityLabel={`${f.label}: ${included ? 'included' : 'not included'} in ${t.name}`}
                >
                  {included ? '✓' : '–'}
                </Text>
              </View>
            );
          })}
        </View>
      ))}

      {/* Terms footer */}
      <View style={[styles.featureRow, styles.termsRow]}>
        <View style={styles.featureCol} />
        {PRICING_TIERS.map((t) => (
          <View key={t.key} style={styles.tierCol}>
            <Text style={[styles.terms, { color: t.color }]} numberOfLines={2}>{t.terms}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const COL_W = 52;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0c0c0b',
    borderWidth: 1,
    borderColor: '#2a2a26',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a26',
  },
  featureCol: { flex: 1 },
  tierCol: { width: COL_W, alignItems: 'center' },
  tierName: { fontFamily: fonts.primary.bold, fontSize: 13, lineHeight: 16 },
  tierPrice: { fontFamily: fonts.mono.regular, fontSize: 11, color: '#94938b', lineHeight: 14, marginTop: 2 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c19',
  },
  featureLabel: { flex: 1, fontFamily: fonts.primary.regular, fontSize: 13, color: '#d8d8d2', lineHeight: 17, paddingRight: 6 },
  cell: { fontSize: 15, lineHeight: 18, textAlign: 'center' },
  termsRow: { borderBottomWidth: 0, paddingTop: 11, paddingBottom: 0 },
  terms: { fontFamily: fonts.mono.regular, fontSize: 9.5, lineHeight: 12, textAlign: 'center' },
});
```

- [ ] **Step 2: Verify typecheck.**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add components/PricingComparison.tsx
git commit -m "feat(pricing): 3-tier PricingComparison component"
```

---

## Task 4: PlusSheet — add `onPurchased` callback

**Files:**
- Modify: `components/PlusSheet.tsx`

Onboarding reuses the PlusSheet for the MoodRx+ trial (it has the annual/monthly toggle + terms). The sheet must tell onboarding when a purchase succeeds so it can finish first-launch + route.

- [ ] **Step 1: Extend the props.** In `components/PlusSheet.tsx`, change the component signature:

```tsx
export function PlusSheet({ visible, onClose, onPurchased }: { visible: boolean; onClose: () => void; onPurchased?: () => void }) {
```

- [ ] **Step 2: Fire it on success.** In the same file, update the two purchase buttons' `onSuccess` handlers (`trialBtn` and `baseBtn`) from `onSuccess: onClose` to:

```tsx
    onSuccess: () => { onPurchased?.(); onClose(); },
```

(Apply to both `trialBtn` and `baseBtn`.)

- [ ] **Step 3: Verify typecheck.**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add components/PlusSheet.tsx
git commit -m "feat(pricing): PlusSheet onPurchased callback for onboarding"
```

---

## Task 5: Onboarding 2-tile carousel + pricing tile

**Files:**
- Modify: `app/onboarding.tsx`

The screen becomes a horizontal 2-page pager. Page 1 = the existing how-it-works content (unchanged blocks). Page 2 = `PricingComparison` + three CTAs. The old `ownBlock` + its two buttons are removed (replaced by page 2). Voices/AI are now disclosed by the comparison.

- [ ] **Step 1: Add imports + screen-width constant.** At the top of `app/onboarding.tsx`, add to the `react-native` import list `Dimensions` and `NativeSyntheticEvent`, `NativeScrollEvent`; and add imports:

```tsx
import { PricingComparison } from '@/components/PricingComparison';
import { PlusSheet } from '@/components/PlusSheet';
```

Below the imports add:

```tsx
const SCREEN_W = Dimensions.get('window').width;
```

- [ ] **Step 2: Drop the now-unused base-feature copy.** Remove the `TRIAL_FEATURES` array (lines ~40-44) — the comparison replaces it.

- [ ] **Step 3: Add carousel + trial state and the live prices.** Inside `OnboardingScreen`, after the existing `const { purchaseBase, isLoading: subLoading } = useSubscription();` line, also pull offerings and add state. Replace that line with:

```tsx
  const { purchaseBase, offerings, isLoading: subLoading } = useSubscription();
  const [page, setPage] = useState(0);
  const [plusVisible, setPlusVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const plusPkgs = offerings?.all?.['plus']?.availablePackages ?? [];
  const monthlyPrice = plusPkgs.find((p) => p.identifier === '$rc_monthly')?.product?.priceString ?? '$3.99/mo';
  const basePrice = offerings?.current?.availablePackages?.find((p) => p.identifier === '$rc_lifetime')?.product?.priceString ?? '$9.99';
```

(Note: `useState` and `useRef` are already imported in this file; confirm `ScrollView` is imported — it is.)

- [ ] **Step 4: Add the page-change handler and a `finishTo` helper.** After `handleFreeVersion`, add:

```tsx
  const onPageScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (p !== page) setPage(p);
  };
  const goToPricing = () => scrollRef.current?.scrollTo({ x: SCREEN_W, animated: true });
  const finishToGuided = useCallback(async () => {
    await setFirstLaunchDone();
    router.replace('/guided');
  }, []);
```

- [ ] **Step 5: Point the Own-it button + add a trial button.** The existing `unlockBtn` (purchaseBase) already routes to `/guided` on success — keep it. The trial is handled by the PlusSheet (opened from page 2), which calls `onPurchased={finishToGuided}`.

- [ ] **Step 6: Restructure the render into two pages.** Replace the single `<ScrollView style={styles.scroll} …>…</ScrollView>` (the outer content scroll, lines ~86-212) with a horizontal pager. Page 1 keeps the existing how-it-works JSX (headline → `wellnessDisclaimer`, i.e. the blocks currently at lines ~91-144). Page 2 is the new pricing tile. Structure:

```tsx
      <Animated.ScrollView
        ref={scrollRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPageScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {/* PAGE 1 — how it works */}
        <ScrollView style={[styles.scroll, { width: SCREEN_W }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* ── existing how-it-works blocks: headline, divider, subtext, body,
                stepsContainer, outcomeProof, preCTALine, wellnessDisclaimer ── */}
          {/* (move them here unchanged) */}
          <TouchableOpacity style={styles.swipeCta} onPress={goToPricing} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="See pricing">
            <Text style={styles.swipeCtaText}>See what it costs →</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* PAGE 2 — pricing */}
        <ScrollView style={[styles.scroll, { width: SCREEN_W }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.headline}>What it costs.</Text>
          <View style={styles.divider} />
          <Text style={styles.subtext}>Simple. No surprises. Only MoodRx+ ever renews.</Text>

          <View style={{ marginTop: 18 }}>
            <PricingComparison prices={{ own: basePrice, plus: monthlyPrice }} />
          </View>

          <Animated.View style={{ transform: [{ scale: trialScale }] }}>
            <TouchableOpacity
              style={[styles.trialButton, unlockBtn.disabled && styles.trialButtonDisabled]}
              onPress={unlockBtn.onPress}
              onPressIn={() => onPressIn(trialScale)}
              onPressOut={() => onPressOut(trialScale)}
              disabled={unlockBtn.disabled}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ disabled: unlockBtn.disabled, busy: unlockBtn.busy }}
              accessibilityLabel="Own MoodRx for 9 dollars 99"
            >
              {unlockBtn.busy ? (
                <ActivityIndicator size="small" color={colors.premium} />
              ) : (
                <Text style={styles.trialButtonText}>{purchaseButtonLabel(unlockBtn.status, { idle: 'OWN IT — $9.99' })}</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity style={styles.plusButton} onPress={() => setPlusVisible(true)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Start 7 day free trial of MoodRx Plus">
            <Text style={styles.plusButtonText}>Start 7-day free trial →</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.freeButton} onPress={handleFreeVersion} activeOpacity={0.6} accessibilityRole="button" accessibilityLabel="Start free, no charge">
            <Text style={styles.freeButtonText}>Start free →</Text>
          </TouchableOpacity>

          {/* existing legalLinksRow + disclaimer move here unchanged */}
        </ScrollView>
      </Animated.ScrollView>

      {/* Pager dots */}
      <View style={styles.dotsRow} importantForAccessibility="no">
        {[0, 1].map((i) => (
          <View key={i} style={[styles.dot, page === i && styles.dotActive]} />
        ))}
      </View>

      <PlusSheet visible={plusVisible} onClose={() => setPlusVisible(false)} onPurchased={finishToGuided} />
```

Keep the outer `<Animated.View style={[styles.container, …]}>` wrapper. Move the `legalLinksRow` + final `disclaimer` blocks into page 2 (after the free button).

- [ ] **Step 7: Add the new styles.** In the `StyleSheet.create({…})`, add:

```tsx
  plusButton: { marginTop: 12, borderWidth: 1, borderColor: colors.tierPlus, borderRadius: 4, paddingVertical: 14, alignItems: 'center' },
  plusButtonText: { fontFamily: fonts.primary.bold, fontSize: 16, color: colors.tierPlus, letterSpacing: 1 },
  swipeCta: { marginTop: 20, alignItems: 'center', paddingVertical: 8 },
  swipeCtaText: { fontFamily: fonts.mono.regular, fontSize: 16, color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3a3a34' },
  dotActive: { backgroundColor: colors.premium, width: 18 },
```

(`fonts` is imported as part of `import { type as t, fonts } from '../lib/typography'` — confirm `fonts` is in that import; add it if missing.)

- [ ] **Step 8: Verify typecheck + lint.**

Run: `npm run typecheck && npm run lint:ci`
Expected: PASS. Resolve any unused-import warnings (e.g. remove `t`/`fonts` if unused, keep what the new styles need).

- [ ] **Step 9: Commit.**

```bash
git add app/onboarding.tsx
git commit -m "feat(onboarding): 2-tile carousel with 3-tier pricing comparison"
```

---

## Task 6: Strip à la carte from VoiceSheet

**Files:**
- Modify: `components/VoiceSheet.tsx`

Voices unlock only via MoodRx+. Remove per-voice buy buttons + the bundle CTA; locked rows route to the PlusSheet via the existing `onPlus`.

- [ ] **Step 1: Slim the props.** In `components/VoiceSheet.tsx`, replace the `Props` interface with:

```tsx
interface Props {
  visible: boolean;
  selected: string;
  /** False until the library manifest is loaded — disables the sample buttons. */
  previewAvailable: boolean;
  isOwned: (name: string) => boolean;
  onSelect: (name: string) => void;
  onPreview: (name: string) => void;
  onClose: () => void;
  onPlus: () => void;
}
```

- [ ] **Step 2: Simplify `VoiceRow`.** Replace the `VoiceRow` component (and its props) with a version that has no buy button:

```tsx
function VoiceRow({
  voice, isSelected, owned, previewAvailable, onSelect, onPreview,
}: {
  voice: VoiceOption;
  isSelected: boolean;
  owned: boolean;
  previewAvailable: boolean;
  onSelect: (name: string) => void;
  onPreview: (name: string) => void;
}) {
  return (
    <View style={[styles.row, isSelected && styles.rowSelected]}>
      <Pressable
        style={styles.rowMain}
        onPress={() => owned && onSelect(voice.name)}
        disabled={!owned}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected, disabled: !owned }}
      >
        <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}>{voice.label}</Text>
        <Text style={styles.rowState}>{isSelected ? 'Selected' : owned ? 'Tap to use' : 'MoodRx+'}</Text>
      </Pressable>
      <Pressable
        style={[styles.sampleBtn, !previewAvailable && styles.sampleBtnDisabled]}
        onPress={() => onPreview(voice.name)}
        disabled={!previewAvailable}
        accessibilityRole="button"
        accessibilityState={{ disabled: !previewAvailable }}
        accessibilityLabel={`Play ${voice.label} sample`}
      >
        <Text style={styles.sampleText}>Sample</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 3: Simplify the sheet body.** Replace the `VoiceSheet` function body's params + JSX with:

```tsx
export function VoiceSheet({
  visible, selected, previewAvailable, isOwned, onSelect, onPreview, onClose, onPlus,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.header}>YOUR COACH</Text>
          <Text style={styles.sub}>Choose who coaches you through a workout.</Text>
          {VOICES.map((v) => (
            <VoiceRow
              key={v.name}
              voice={v}
              isSelected={v.name === selected}
              owned={isOwned(v.name)}
              previewAvailable={previewAvailable}
              onSelect={onSelect}
              onPreview={onPreview}
            />
          ))}
          <Pressable onPress={onPlus} accessibilityRole="button" accessibilityLabel="Unlock every coach with MoodRx Plus" style={styles.plusLink}>
            <Text style={styles.plusLinkText}>Every coach is included with MoodRx+ →</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 4: Remove dead imports + styles.** Remove the now-unused imports `usePurchaseButton` and `purchaseButtonLabel`. Remove the unused styles `voiceBuyBtn`, `voiceBuyDisabled`, `voiceBuyText`, `cta`, `ctaDisabled`, `ctaText`. Keep `plusLink` / `plusLinkText` (make `onPlus` always render — it is now required).

- [ ] **Step 5: Verify typecheck.**

Run: `npm run typecheck`
Expected: FAIL — `CoachVoicePicker.tsx` still passes the removed props. That is fixed in Task 7. (Confirm the failure is only in `CoachVoicePicker.tsx`.)

- [ ] **Step 6: Commit.**

```bash
git add components/VoiceSheet.tsx
git commit -m "refactor(voices): VoiceSheet is MoodRx+-only (no a la carte)"
```

---

## Task 7: Strip à la carte from CoachVoicePicker

**Files:**
- Modify: `components/CoachVoicePicker.tsx`

- [ ] **Step 1: Remove à la carte wiring.** Replace the top of `CoachVoicePicker` (the `useSubscription` destructure through the `bundleLabel` line, ~lines 16-87) so it no longer references `purchaseVoice` / `purchasePack` / packages / prices / bundle. The new `useSubscription` line:

```tsx
  const { ownsVoice, isLoading: subLoading } = useSubscription();
```

Remove these now-unused pieces entirely:
- the `PACKS_OFFERING_ID, VOICE_PACK_ID` import from `@/lib/revenuecat`;
- the `usePurchaseButton` and `purchaseButtonLabel` imports;
- the `voiceEntitlementId` import (keep `VOICES`);
- `packages`, `priceOf`, `voicePrice`, `bundlePrice`, `allPaidOwned`, `bundleBtn`, `bundleLabel`.

(`subLoading` is no longer needed for offerings — it can be dropped from the destructure too if nothing else uses it. Confirm and remove if unused.)

- [ ] **Step 2: Slim the VoiceSheet usage.** Replace the `<VoiceSheet … />` element with:

```tsx
      <VoiceSheet
        visible={open}
        selected={selected}
        previewAvailable={previewAvailable}
        isOwned={ownsVoice}
        onSelect={handleSelect}
        onPreview={handlePreview}
        onClose={handleClose}
        onPlus={() => setPlusVisible(true)}
      />
```

- [ ] **Step 3: Reframe the row hint.** Change the picker row hint copy:

```tsx
          <Text style={styles.hint}>Choose who coaches you through a workout.</Text>
```

- [ ] **Step 4: Verify typecheck + lint.**

Run: `npm run typecheck && npm run lint:ci`
Expected: PASS for both VoiceSheet and CoachVoicePicker (Task 6's failure is now resolved). Resolve any remaining unused-import lint errors.

- [ ] **Step 5: Commit.**

```bash
git add components/CoachVoicePicker.tsx
git commit -m "refactor(voices): CoachVoicePicker drops a la carte; coaches via MoodRx+"
```

---

## Task 8: Remove purchaseVoice / purchasePack / ownsPack from context

**Files:**
- Modify: `contexts/SubscriptionContext.tsx`

- [ ] **Step 1: Remove from the interface.** In `SubscriptionContextValue`, delete the `ownsPack`, `purchasePack`, and `purchaseVoice` member declarations (and their doc comments).

- [ ] **Step 2: Remove the implementations.** Delete the `ownsPack` `useCallback` (~lines 103-108), the `purchasePack` `useCallback` (~lines 192-197), and the `purchaseVoice` `useCallback` (~lines 199-205).

- [ ] **Step 3: Remove from the value + deps.** In the `useMemo` value object and its dependency array, delete the `ownsPack`, `purchasePack`, and `purchaseVoice` entries (both occurrences each).

- [ ] **Step 4: Remove now-unused imports.** Remove `PACKS_OFFERING_ID`, `VOICE_PACK_ID` (if imported), and `packEntitlementId` from the `@/lib/revenuecat` import. Keep `REVENUECAT_ENTITLEMENT_IDENTIFIER`, `ALL_ACCESS_ENTITLEMENT_IDENTIFIER`, `BASE_UNLOCK_PACKAGE_ID`, `PLUS_OFFERING_ID`. (`ownsVoice` uses `resolveOwnsVoice` from `@/lib/voices` — unchanged.)

- [ ] **Step 5: Verify typecheck.**

Run: `npm run typecheck`
Expected: FAIL — `app/packs.tsx` still uses `ownsPack` / `purchasePack`. Resolved in Task 9. Confirm the only remaining errors are in `app/packs.tsx`.

- [ ] **Step 6: Commit.**

```bash
git add contexts/SubscriptionContext.tsx
git commit -m "refactor(purchases): remove ownsPack/purchasePack/purchaseVoice"
```

---

## Task 9: Delete the packs store + premium link + unused revenuecat exports

**Files:**
- Delete: `app/packs.tsx`
- Modify: `app/premium.tsx`
- Modify: `lib/revenuecat.tsx`

- [ ] **Step 1: Delete the store screen.**

```bash
git rm app/packs.tsx
```

- [ ] **Step 2: Remove the `/packs` link from premium.tsx.** In `app/premium.tsx`, delete the `TouchableOpacity` that does `router.push('/packs' as Href)` (~lines 181-183 and its child content/closing tags). If `Href` is now unused, remove it from the `expo-router` import. Remove any styles that become orphaned (e.g. a packs-link style) — verify via lint.

- [ ] **Step 3: Remove unused exports from revenuecat.tsx.** In `lib/revenuecat.tsx`, delete `PACKS_OFFERING_ID`, `VOICE_PACK_ID`, and `packEntitlementId` (and their doc comments). Keep `REVENUECAT_ENTITLEMENT_IDENTIFIER`, `BASE_UNLOCK_PACKAGE_ID`, `PLUS_OFFERING_ID`, `ALL_ACCESS_ENTITLEMENT_IDENTIFIER`.

- [ ] **Step 4: Confirm `lib/voices.ts` still compiles.** It inlines its own `'pack_voice_pack'` / `'all_access'` constants (does not import from `revenuecat.tsx`), so `ownsVoice` is unaffected. No change needed — just confirm typecheck.

- [ ] **Step 5: Verify typecheck + lint + tests.**

Run: `npm run typecheck && npm run lint:ci && npm test`
Expected: PASS for all. (If `grep` finds any lingering `PACKS_OFFERING_ID` / `VOICE_PACK_ID` / `packEntitlementId` / `ownsPack` / `purchasePack` / `purchaseVoice` reference, fix it.)

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "chore(purchases): delete a la carte packs store + unused exports"
```

---

## Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Static checks.**

Run: `npm run typecheck && npm run lint:ci && npm test`
Expected: typecheck clean, lint clean, all vitest suites pass (including `pricing-tiers`).

- [ ] **Step 2: Confirm no à la carte references remain.**

Run (Grep tool or): `git grep -nE "purchaseVoice|purchasePack|ownsPack|voiceBuyBtn|onBuyVoice|onBuyBundle|/packs" -- app lib components contexts`
Expected: no matches (scripts/ may still reference the RC `packs` offering — that is fine, those are admin scripts).

- [ ] **Step 3: On-device (local debug build, Metro over wifi — no EAS):**
  - Fresh install / reset onboarding: swipe between the two tiles; confirm the pricing comparison shows Free white / Own it blue / MoodRx+ green with the correct ✓/– per the matrix.
  - Tap **OWN IT — $9.99** → completes the base test-store purchase → routes to `/guided`.
  - Tap **Start 7-day free trial** → PlusSheet opens (annual/monthly toggle + terms); completing it routes to `/guided`.
  - Tap **Start free →** → no purchase/charge, routes to `/guided`.
  - Coach voice picker: locked coaches show no price, show "MoodRx+", and the "Every coach is included with MoodRx+ →" link opens the PlusSheet; with MoodRx+ active every coach unlocks.
  - Confirm no $0.99 / $2.99 price appears anywhere, and `/packs` is unreachable (the premium-screen link is gone).

- [ ] **Step 4: Final commit (if any verification fixes were needed).**

```bash
git add -A
git commit -m "test(pricing): on-device verification fixes"
```

---

## Self-review notes

- **Spec coverage:** model statement (Task 5 comparison) ✓; onboarding carousel (Task 5) ✓; voices→MoodRx+ + à la carte removal (Tasks 6–9) ✓; tier colors columns-only (Tasks 1, 3) ✓; honest "Start free" vs "Start 7-day free trial" distinction (Task 5 — separate controls/labels) ✓; remove `purchaseVoice`/`purchasePack`/`ownsPack` (Tasks 7–9) ✓; packs-store removal (Task 9) ✓; matrix-matches-gating test (Task 2) ✓.
- **Roadmap (not in this plan):** coaches shaping the prescription; RC removal of dormant `voice_*` products.
- **Type consistency:** `TierKey` (`free`/`own`/`plus`), `PricingFeature` keys, and `tierValue` are used identically in Tasks 2–3; `onPurchased` prop name matches between Tasks 4 and 5; `onPlus` is required in VoiceSheet (Task 6) and always supplied (Task 7).
