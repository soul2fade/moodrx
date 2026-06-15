# MoodRx+ Commerce Surfaces (Phase E2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let owners start a 7-day MoodRx+ trial / subscribe via one shared `PlusSheet`, surfaced by a gentle post-workout prompt when the live-coach taste runs out, plus quiet secondary entries.

**Architecture:** A `plus` RevenueCat offering (monthly/annual) + `purchasePlus(period)` on the context (grants `all_access`). A self-contained `PlusSheet` (owns its own `usePurchaseButton` controllers, like `PremiumSheet`). Hosts (post-workout prompt, voice picker, settings) just toggle its visibility. Builds on E1 (`isPlus`, `canUseLiveCoach`, taste) + Phase A states.

**Tech Stack:** React Native (Expo), TypeScript, RevenueCat. JS-only; UI + mock-grant flow locally testable; real trial/subscription products are manual store config (external). No `app.json`/native changes.

---

## File Structure

- **Modify** `lib/revenuecat.tsx` — add `PLUS_OFFERING_ID`.
- **Modify** `contexts/SubscriptionContext.tsx` — add `purchasePlus(period)`.
- **Create** `components/PlusSheet.tsx` — self-contained MoodRx+ subscription sheet.
- **Modify** `app/post-workout.tsx` — gentle inline prompt (taste spent) → `PlusSheet`.
- **Modify** `components/CoachVoicePicker.tsx` + `components/VoiceSheet.tsx` — "Included with MoodRx+ →" entry.
- **Modify** `app/settings.tsx` — "MoodRx+" row → `PlusSheet`.

---

## Task 1: `plus` offering id + `purchasePlus`

**Files:** `lib/revenuecat.tsx`, `contexts/SubscriptionContext.tsx`.

- [ ] **Step 1:** In `lib/revenuecat.tsx`, after `PACKS_OFFERING_ID`, add:

```tsx
/** Offering holding the MoodRx+ subscription products (monthly + annual). */
export const PLUS_OFFERING_ID = 'plus';
```

- [ ] **Step 2:** In `contexts/SubscriptionContext.tsx`:
  - Add `PLUS_OFFERING_ID` to the existing `@/lib/revenuecat` import.
  - Interface: after `purchaseVoice`, add:
    ```tsx
      /** Resolves true when MoodRx+ (all_access) was actually granted. */
      purchasePlus: (period: 'monthly' | 'annual') => Promise<boolean>;
    ```
  - After the `purchaseVoice` useCallback, add:
    ```tsx
      const purchasePlus = useCallback((period: 'monthly' | 'annual'): Promise<boolean> => {
        const pkgId = period === 'annual' ? '$rc_annual' : '$rc_monthly';
        const pkg = offerings?.all?.[PLUS_OFFERING_ID]?.availablePackages?.find(
          (p) => p.identifier === pkgId,
        );
        return triggerPurchase(pkg, ALL_ACCESS_ENTITLEMENT_IDENTIFIER);
      }, [offerings, triggerPurchase]);
    ```
  - Add `purchasePlus` to the `useMemo` value object AND its dependency array (near `purchaseVoice`).

- [ ] **Step 3:** `npm run typecheck && npx eslint contexts/SubscriptionContext.tsx lib/revenuecat.tsx && npm test` — clean/passing.

- [ ] **Step 4:** Commit:
```bash
git add lib/revenuecat.tsx contexts/SubscriptionContext.tsx
git commit -m "feat(plus): plus offering id + purchasePlus(period) granting all_access"
```

---

## Task 2: `PlusSheet` component

**Files:** Create `components/PlusSheet.tsx`.

- [ ] **Step 1:** Create the file:

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PLUS_OFFERING_ID } from '@/lib/revenuecat';
import { usePurchaseButton } from '@/hooks/usePurchaseButton';
import { purchaseButtonLabel } from '@/lib/purchase-ui';
import { type as t } from '@/lib/typography';
import { colors } from '@/lib/colors';

const MONTHLY_PKG = '$rc_monthly';
const ANNUAL_PKG = '$rc_annual';

export function PlusSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { purchasePlus, purchaseBase, restorePurchases, offerings, isLoading: subLoading } = useSubscription();
  const [period, setPeriod] = useState<'monthly' | 'annual'>('annual');

  const pkgs = offerings?.all?.[PLUS_OFFERING_ID]?.availablePackages ?? [];
  const priceOf = (id: string, fallback: string) =>
    pkgs.find((p) => p.identifier === id)?.product?.priceString ?? fallback;
  const monthlyPrice = priceOf(MONTHLY_PKG, '$3.99');
  const annualPrice = priceOf(ANNUAL_PKG, '$24.99');

  const trialBtn = usePurchaseButton({
    offeringsLoaded: !subLoading,
    run: () => purchasePlus(period),
    onSuccess: onClose,
  });
  const baseBtn = usePurchaseButton({
    offeringsLoaded: !subLoading,
    run: purchaseBase,
    onSuccess: onClose,
  });
  const restoreBtn = usePurchaseButton({
    offeringsLoaded: true,
    run: restorePurchases,
    onSuccess: onClose,
  });

  const openURL = (url: string) => {
    void Linking.openURL(url).catch(() =>
      Alert.alert('Could not open link', 'Visit soul2fade.github.io/moodrx in your browser.'),
    );
  };

  const PlanRow = ({ id, label, price, suffix, tag }: { id: 'monthly' | 'annual'; label: string; price: string; suffix: string; tag?: string }) => {
    const selected = period === id;
    return (
      <Pressable
        style={[styles.planRow, selected && styles.planRowSelected]}
        onPress={() => setPeriod(id)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${label}, ${price} ${suffix}`}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.planLabel}>{label}</Text>
          <Text style={styles.planPrice}>{price} {suffix}</Text>
        </View>
        {tag ? <Text style={styles.planTag}>{tag}</Text> : null}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Dismiss" accessibilityRole="button" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.headline}>Keep the live coach.</Text>
        <Text style={styles.description}>Live Dr. MoodRx + every voice + new content packs.</Text>
        <Text style={styles.trialLine}>7 days free, then your plan.</Text>

        <PlanRow id="annual" label="Annual" price={annualPrice} suffix="/yr" tag="SAVE ~HALF" />
        <PlanRow id="monthly" label="Monthly" price={monthlyPrice} suffix="/mo" />

        <TouchableOpacity
          style={[styles.cta, trialBtn.disabled && styles.ctaDisabled]}
          onPress={trialBtn.onPress}
          disabled={trialBtn.disabled}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ disabled: trialBtn.disabled, busy: trialBtn.busy }}
          accessibilityLabel="Start 7-day free trial"
        >
          {trialBtn.busy ? (
            <ActivityIndicator size="small" color={colors.premium} />
          ) : (
            <Text style={styles.ctaText}>{purchaseButtonLabel(trialBtn.status, { idle: 'START 7-DAY FREE TRIAL' })}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.softLanding}
          onPress={baseBtn.onPress}
          disabled={baseBtn.disabled}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ disabled: baseBtn.disabled, busy: baseBtn.busy }}
          accessibilityLabel="Own the core once for $9.99"
        >
          {baseBtn.busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.softLandingText}>
              {purchaseButtonLabel(baseBtn.status, { idle: 'Own the core once — $9.99', success: "You're in ✓" })}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.legalLinksRow}>
          <TouchableOpacity onPress={() => openURL('https://soul2fade.github.io/moodrx/terms.html')} activeOpacity={0.7} accessibilityRole="link" accessibilityLabel="Terms of Use">
            <Text style={styles.legalLinkText}>TERMS OF USE</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity onPress={() => openURL('https://soul2fade.github.io/moodrx/privacy-policy.html')} activeOpacity={0.7} accessibilityRole="link" accessibilityLabel="Privacy Policy">
            <Text style={styles.legalLinkText}>PRIVACY POLICY</Text>
          </TouchableOpacity>
        </View>

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
              <Text style={styles.closeText}>{purchaseButtonLabel(restoreBtn.status, { idle: 'RESTORE PURCHASE', success: 'RESTORED ✓' })}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.footerBtn} accessibilityRole="button" accessibilityLabel="Maybe later">
            <Text style={styles.closeText}>MAYBE LATER</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#333333', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  handle: { width: 32, height: 2, backgroundColor: '#333333', alignSelf: 'center', marginBottom: 24 },
  headline: { ...t.headlineMd, fontSize: 24 },
  description: { ...t.bodyMuted, color: '#ffffff', marginTop: 10 },
  trialLine: { ...t.body, color: colors.premium, fontWeight: '700', marginTop: 14, marginBottom: 12 },
  planRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#333333', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10 },
  planRowSelected: { borderColor: colors.premium, backgroundColor: '#1a1407' },
  planLabel: { ...t.body, color: '#ffffff', fontWeight: '700' },
  planPrice: { ...t.bodySm, color: '#e8e8e8', marginTop: 2 },
  planTag: { ...t.label, color: colors.premium, letterSpacing: 1.5 },
  cta: { borderWidth: 1, borderColor: colors.premium, paddingVertical: 16, alignItems: 'center', marginTop: 6, marginBottom: 10 },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { ...t.button, color: colors.premium, letterSpacing: 2 },
  softLanding: { alignItems: 'center', paddingVertical: 10, marginBottom: 6 },
  softLandingText: { ...t.body, color: '#ffffff' },
  legalLinksRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 12 },
  legalLinkText: { ...t.label, color: '#ffffff', letterSpacing: 1.5 },
  legalDot: { ...t.softMuted },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  footerBtn: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  closeText: { ...t.label, color: '#ffffff', letterSpacing: 3 },
});
```

- [ ] **Step 2:** `npm run typecheck && npx eslint components/PlusSheet.tsx` — clean. (Watch the `local/no-tiny-fontsize` ≥16 rule — all sizes here come from `t.*` tokens which comply.)

- [ ] **Step 3:** Commit:
```bash
git add components/PlusSheet.tsx
git commit -m "feat(plus): MoodRx+ subscription sheet (trial-first, annual/monthly, soft-landing)"
```

---

## Task 3: Post-workout inline prompt → PlusSheet

**Files:** `app/post-workout.tsx`.

- [ ] **Step 1:** Imports — add `import { PlusSheet } from '@/components/PlusSheet';`. Add `LIVE_COACH_TASTE_LIMIT`? Not needed — reuse `canUseLiveCoach`.

- [ ] **Step 2:** State — near the other `useState`s add:
```tsx
  const [liveCoachLocked, setLiveCoachLocked] = useState(false);
  const [plusVisible, setPlusVisible] = useState(false);
```

- [ ] **Step 3:** In the dynamic-coach effect, set `liveCoachLocked` when the gate blocks a non-plus user. Replace the gate early-return:
```tsx
      const tasteUsed = await getLiveCoachTasteUsed();
      if (!canUseLiveCoach({ isPlus, tasteUsed })) return; // out of taste → keep stock line
```
with:
```tsx
      const tasteUsed = await getLiveCoachTasteUsed();
      if (!canUseLiveCoach({ isPlus, tasteUsed })) {
        if (!isPlus && !cancelled) setLiveCoachLocked(true); // show the gentle MoodRx+ prompt
        return; // out of taste → keep stock line
      }
```

- [ ] **Step 4:** Render the prompt — directly after the `insultLine` `<Text>` block (the `{(dynamicLine ?? postInsult) !== '' && (...)}`), add:
```tsx
        {liveCoachLocked && (
          <TouchableOpacity
            onPress={() => setPlusVisible(true)}
            activeOpacity={0.7}
            style={styles.plusPrompt}
            accessibilityRole="button"
            accessibilityLabel="Keep the live coach with MoodRx Plus"
          >
            <Text style={styles.plusPromptText}>Dr. MoodRx wrote your first few live. Keep the live coach →</Text>
          </TouchableOpacity>
        )}
```

- [ ] **Step 5:** Render the sheet — near the end of the returned JSX (before the outermost closing tag of the screen), add:
```tsx
      <PlusSheet visible={plusVisible} onClose={() => setPlusVisible(false)} />
```

- [ ] **Step 6:** Styles — add to the StyleSheet:
```tsx
  plusPrompt: { marginTop: 14, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  plusPromptText: { ...t.bodySm, color: colors.premium, textAlign: 'center' },
```
(Confirm `colors` and `t` are imported in post-workout.tsx — `t`/`fonts` from typography are; add `colors` from `@/lib/colors` if missing.)

- [ ] **Step 7:** `npm run typecheck && npx eslint app/post-workout.tsx && npm test` — clean/passing.

- [ ] **Step 8:** Commit:
```bash
git add app/post-workout.tsx
git commit -m "feat(plus): gentle post-workout prompt to keep the live coach"
```

---

## Task 4: Secondary entries (voice picker + settings)

**Files:** `components/VoiceSheet.tsx`, `components/CoachVoicePicker.tsx`, `app/settings.tsx`.

- [ ] **Step 1: Voice picker.** In `components/VoiceSheet.tsx`, add an optional prop `onPlus?: () => void` to `Props`, and render a quiet line after the bundle CTA block:
```tsx
          {onPlus && (
            <Pressable onPress={onPlus} accessibilityRole="button" accessibilityLabel="Included with MoodRx Plus" style={styles.plusLink}>
              <Text style={styles.plusLinkText}>Included with MoodRx+ →</Text>
            </Pressable>
          )}
```
Add styles: `plusLink: { marginTop: 12, alignItems: 'center' }`, `plusLinkText: { color: '#E8B84B', fontSize: 16, fontWeight: '600' }`.

In `components/CoachVoicePicker.tsx`: add `const [plusVisible, setPlusVisible] = useState(false);`, import `PlusSheet`, pass `onPlus={() => setPlusVisible(true)}` to `<VoiceSheet>`, and render `<PlusSheet visible={plusVisible} onClose={() => setPlusVisible(false)} />` after `</VoiceSheet>`'s sibling (inside the returned fragment).

- [ ] **Step 2: Settings.** In `app/settings.tsx`, import `PlusSheet`, add `const [plusVisible, setPlusVisible] = useState(false);`. In the Pro section (near the upgrade row), add a row:
```tsx
        <TouchableOpacity onPress={() => setPlusVisible(true)} activeOpacity={0.7} style={styles.subStatusRow} accessibilityRole="button" accessibilityLabel="MoodRx Plus">
          <Text style={styles.subStatusLabel}>MOODRX+</Text>
          <Text style={styles.upgradeBtnText}>LIVE COACH →</Text>
        </TouchableOpacity>
```
(reuse existing `subStatusRow`/`subStatusLabel`/`upgradeBtnText` styles). Render `<PlusSheet visible={plusVisible} onClose={() => setPlusVisible(false)} />` near the other modals/sheets at the end of the screen JSX.

- [ ] **Step 3:** `npm run typecheck && npx eslint components/VoiceSheet.tsx components/CoachVoicePicker.tsx app/settings.tsx && npm test` — clean/passing.

- [ ] **Step 4:** Commit:
```bash
git add components/VoiceSheet.tsx components/CoachVoicePicker.tsx app/settings.tsx
git commit -m "feat(plus): MoodRx+ entries on the voice picker + settings"
```

---

## Task 5: Full verification + final review

- [ ] `npm test`, `npm run typecheck`, `npx eslint app/ lib/ components/ contexts/ hooks/` — green (1 pre-existing `micro-workout.ts` warning allowed).
- [ ] On-device (local debug, mock-grant): exhaust the taste (base on, no plus, 3 post-workouts) → the gentle prompt appears → tap → `PlusSheet` opens (annual preselected, "SAVE ~HALF"); tap "START 7-DAY FREE TRIAL" → dev confirm → `all_access` granted → `isPlus` → live coach unlimited + voices unlocked + prompt gone. Voice-picker "Included with MoodRx+" and the settings MoodRx+ row open the same sheet. The "Own the core once — $9.99" runs the base purchase.
- [ ] Final reviewer pass over the E2 diff.

---

## Self-Review

- **Spec coverage:** §2 products + `purchasePlus` → Task 1. §3 PlusSheet (trial-first, annual/monthly, trial CTA w/ Phase-A states, baked-in $9.99 soft-landing, restore/maybe-later) → Task 2. §4 gentle post-workout prompt reusing `canUseLiveCoach` → Task 3. §5 voice-picker + settings entries → Task 4. §6 testing → Task 5. ✓
- **Scope:** no E1/base/voice gating changes; store config external; no `app.json`. ✓
- **Placeholder scan:** PlusSheet given in full; host integrations are exact snippets reusing existing styles; package ids `$rc_monthly`/`$rc_annual` consistent between Task 1 and Task 2. ✓
- **Type consistency:** `purchasePlus(period: 'monthly'|'annual')`, `PLUS_OFFERING_ID`, `PlusSheet({ visible, onClose })`, `canUseLiveCoach` reuse — consistent across tasks. ✓
