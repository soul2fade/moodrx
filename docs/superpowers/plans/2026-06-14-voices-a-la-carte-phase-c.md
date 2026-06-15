# Voices à la carte (Phase C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users buy each paid coach voice for $0.99 or all four for $2.99 at the voice picker, with the Phase-A loading/success states.

**Architecture:** Extend the pure `lib/voices.ts` registry with per-voice entitlement resolution (`ownsVoice`, `voiceEntitlementId`) and refactor `effectiveVoice` to per-voice ownership. `SubscriptionContext` gains `purchaseVoice(name)`, `ownsVoice(name)`, and exposes `ownedEntitlements`. The picker (`VoiceSheet`) gets a per-voice `VoiceRow` (Sample + $0.99 buy, auto-selects on success) plus the existing "All voices — $2.99" bundle CTA, both via `usePurchaseButton`.

**Tech Stack:** React Native (Expo), TypeScript, vitest, RevenueCat (`react-native-purchases`). JS-only — verifies on the local debug build + `__DEV__` mock-grant, **no EAS build**. The four `voice_*` store products are separate manual dashboard config (out of code scope). Builds on Phase A (`usePurchaseButton`, `lib/purchase-ui.ts`) and the existing voice infra.

---

## File Structure

- **Modify** `lib/voices.ts` — add `voiceEntitlementId`, `ownsVoice(name, owned)`; refactor `effectiveVoice(selected, owned)` to a Set. Pure, RN-free (vitest-safe); mirror entitlement-id literals locally.
- **Modify** `lib/__tests__/voices.test.ts` — add `ownsVoice`/`voiceEntitlementId` tests; update `effectiveVoice` tests to the new signature.
- **Modify** `contexts/SubscriptionContext.tsx` — add `purchaseVoice(name)`, `ownsVoice(name)`, expose `ownedEntitlements`.
- **Modify** `app/workout.tsx` — update the single `effectiveVoice` caller.
- **Modify** `components/VoiceSheet.tsx` — add internal `VoiceRow` (per-voice buy) + rework props for per-voice ownership/price; keep the bundle CTA.
- **Modify** `components/CoachVoicePicker.tsx` — provide per-voice ownership/price/purchase + bundle controller to `VoiceSheet`.

No new files. The four `voice_*` non-consumables are created in App Store Connect + Google Play + RevenueCat (manual; not in this plan).

---

## Task 1: Pure per-voice entitlement logic (TDD)

**Files:**
- Modify: `lib/voices.ts`
- Test: `lib/__tests__/voices.test.ts`

- [ ] **Step 1: Add the failing tests** — append inside `lib/__tests__/voices.test.ts` (and add the imports `ownsVoice, voiceEntitlementId` to the existing top `import { ... } from '../voices';`):

```typescript
describe('voiceEntitlementId', () => {
  it('namespaces the voice id', () => {
    expect(voiceEntitlementId('ed')).toBe('voice_ed');
  });
});

describe('ownsVoice', () => {
  it('free voices are always owned', () => {
    expect(ownsVoice('rachel', new Set())).toBe(true);
  });
  it('owns a paid voice via its own entitlement', () => {
    expect(ownsVoice('ed', new Set(['voice_ed']))).toBe(true);
  });
  it('owns any paid voice via the bundle', () => {
    expect(ownsVoice('ed', new Set(['pack_voice_pack']))).toBe(true);
    expect(ownsVoice('ruthie', new Set(['pack_voice_pack']))).toBe(true);
  });
  it('owns any paid voice via all_access', () => {
    expect(ownsVoice('ed', new Set(['all_access']))).toBe(true);
  });
  it('does not own an unpurchased paid voice', () => {
    expect(ownsVoice('ed', new Set(['voice_deadpan']))).toBe(false);
    expect(ownsVoice('ed', new Set())).toBe(false);
  });
  it('an unknown voice is not owned', () => {
    expect(ownsVoice('mystery', new Set(['voice_mystery']))).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run lib/__tests__/voices.test.ts`
Expected: FAIL — `ownsVoice`/`voiceEntitlementId` are not exported.

- [ ] **Step 3: Implement** — append to `lib/voices.ts` (after `effectiveVoice`):

```typescript
// Mirror of entitlement ids in lib/revenuecat.tsx — inlined so this module
// imports no react-native (revenuecat.tsx pulls in react-native-purchases,
// which would break the vitest node env). Source of truth: lib/revenuecat.tsx.
const VOICE_PACK_ENTITLEMENT = 'pack_voice_pack'; // packEntitlementId('voice_pack')
const ALL_ACCESS_ENTITLEMENT = 'all_access';

/** Per-voice non-consumable entitlement/product id, e.g. 'voice_ed'. */
export function voiceEntitlementId(name: string): string {
  return `voice_${name}`;
}

/** Whether the user can use a voice: free voices always; otherwise owns the
 *  per-voice entitlement, the bundle, or all-access (future MoodRx+). */
export function ownsVoice(name: string, owned: ReadonlySet<string>): boolean {
  const v = VOICES.find((x) => x.name === name);
  if (!v) return false;
  if (v.free) return true;
  return (
    owned.has(voiceEntitlementId(name)) ||
    owned.has(VOICE_PACK_ENTITLEMENT) ||
    owned.has(ALL_ACCESS_ENTITLEMENT)
  );
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `npx vitest run lib/__tests__/voices.test.ts`
Expected: PASS (existing `effectiveVoice` tests still pass — unchanged this task).

- [ ] **Step 5: Commit**

```bash
git add lib/voices.ts lib/__tests__/voices.test.ts
git commit -m "feat(voices): per-voice ownership resolution (ownsVoice + voiceEntitlementId)"
```

---

## Task 2: SubscriptionContext — purchaseVoice, ownsVoice, ownedEntitlements

**Files:**
- Modify: `contexts/SubscriptionContext.tsx`

- [ ] **Step 1: Add the voices import** — after the `@/lib/revenuecat` import block add:

```tsx
import { ownsVoice as resolveOwnsVoice, voiceEntitlementId } from '@/lib/voices';
```

- [ ] **Step 2: Extend the context interface** — in `interface SubscriptionContextValue`, directly after the `ownsPack` line, add:

```tsx
  /** True when the user can use the given coach voice (owns it, the bundle, or all-access). */
  ownsVoice: (name: string) => boolean;
  /** All currently-held entitlement identifiers (consumed by effectiveVoice). */
  ownedEntitlements: ReadonlySet<string>;
```

and directly after the `purchasePack` line add:

```tsx
  /** Resolves true when the given voice was actually granted. */
  purchaseVoice: (name: string) => Promise<boolean>;
```

- [ ] **Step 3: Add the `ownsVoice` resolver** — directly after the existing `const ownsPack = useCallback(...)` block:

```tsx
  const ownsVoice = useCallback(
    (name: string): boolean => resolveOwnsVoice(name, ownedEntitlements),
    [ownedEntitlements],
  );
```

- [ ] **Step 4: Add `purchaseVoice`** — directly after the existing `const purchasePack = useCallback(...)` block:

```tsx
  const purchaseVoice = useCallback((name: string): Promise<boolean> => {
    const productId = voiceEntitlementId(name); // 'voice_<name>' — product id === entitlement id
    const pkg = offerings?.all?.[PACKS_OFFERING_ID]?.availablePackages?.find(
      (p) => p.identifier === productId,
    );
    return triggerPurchase(pkg, productId);
  }, [offerings, triggerPurchase]);
```

- [ ] **Step 5: Expose them in the context value** — in the `useMemo` value object add `ownsVoice`, `ownedEntitlements`, and `purchaseVoice`, and add the same three to the dependency array. The result:

```tsx
  const value = useMemo<SubscriptionContextValue>(
    () => ({
      isPremium,
      ownsPack,
      ownsVoice,
      ownedEntitlements,
      isLoading,
      offerings,
      purchaseBase,
      purchasePack,
      purchaseVoice,
      restorePurchases,
      devTogglePremium,
    }),
    [
      isPremium,
      ownsPack,
      ownsVoice,
      ownedEntitlements,
      isLoading,
      offerings,
      purchaseBase,
      purchasePack,
      purchaseVoice,
      restorePurchases,
      devTogglePremium,
    ]
  );
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npx eslint contexts/SubscriptionContext.tsx && npm test`
Expected: clean; all tests pass (no behavior change to existing consumers — additive).

- [ ] **Step 7: Commit**

```bash
git add contexts/SubscriptionContext.tsx
git commit -m "feat(voices): purchaseVoice + ownsVoice + ownedEntitlements on SubscriptionContext"
```

---

## Task 3: Refactor `effectiveVoice` to per-voice ownership + update caller

**Files:**
- Modify: `lib/voices.ts`, `lib/__tests__/voices.test.ts`, `app/workout.tsx`

- [ ] **Step 1: Update the `effectiveVoice` tests** — replace the existing `describe('effectiveVoice', ...)` block in `lib/__tests__/voices.test.ts` with:

```typescript
describe('effectiveVoice', () => {
  it('a free voice always plays', () => {
    expect(effectiveVoice('rachel', new Set())).toBe('rachel');
  });
  it('a paid voice plays when its own entitlement is owned', () => {
    expect(effectiveVoice('grampa', new Set(['voice_grampa']))).toBe('grampa');
  });
  it('a paid voice plays when the bundle is owned', () => {
    expect(effectiveVoice('grampa', new Set(['pack_voice_pack']))).toBe('grampa');
  });
  it('a paid voice falls back to rachel when unowned', () => {
    expect(effectiveVoice('grampa', new Set())).toBe('rachel');
  });
  it('an unknown voice falls back to rachel', () => {
    expect(effectiveVoice('mystery', new Set(['voice_mystery']))).toBe('rachel');
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run lib/__tests__/voices.test.ts`
Expected: FAIL — current `effectiveVoice(selected, ownsBundle: boolean)` doesn't accept a Set (type/logic mismatch).

- [ ] **Step 3: Refactor `effectiveVoice`** — replace the existing function in `lib/voices.ts`:

```typescript
/** Which voice actually plays: a free voice as-is; a paid voice only when owned
 *  (per-voice, bundle, or all-access); otherwise fall back to 'rachel'. Pure. */
export function effectiveVoice(selected: string, owned: ReadonlySet<string>): string {
  const v = VOICES.find((x) => x.name === selected);
  if (!v) return 'rachel';
  return v.free || ownsVoice(selected, owned) ? selected : 'rachel';
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `npx vitest run lib/__tests__/voices.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the caller in `app/workout.tsx`**

The current line (~147) is:

```tsx
  const voice = effectiveVoice(selectedVoice, ownsPack(VOICE_PACK_ID));
```

Replace with:

```tsx
  const voice = effectiveVoice(selectedVoice, ownedEntitlements);
```

Then, where `app/workout.tsx` destructures `useSubscription()`, add `ownedEntitlements`. If `ownsPack` (and the `VOICE_PACK_ID` import) are now unused in this file, remove them. Run `npx eslint app/workout.tsx` to confirm no unused-symbol errors and fix any it reports.

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npx eslint lib/voices.ts app/workout.tsx && npm test`
Expected: clean; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/voices.ts lib/__tests__/voices.test.ts app/workout.tsx
git commit -m "refactor(voices): effectiveVoice resolves per-voice ownership"
```

---

## Task 4: Picker UI — per-voice buy + bundle

**Files:**
- Modify: `components/VoiceSheet.tsx`, `components/CoachVoicePicker.tsx`

This task changes the `VoiceSheet` prop interface and `CoachVoicePicker` together (atomic — they must match).

- [ ] **Step 1: Rewrite `components/VoiceSheet.tsx`** with an internal per-voice `VoiceRow` (its own `usePurchaseButton`) and a reworked prop set. Full file:

```tsx
import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { VOICES, type VoiceOption } from '@/lib/voices';
import { usePurchaseButton } from '@/hooks/usePurchaseButton';
import { purchaseButtonLabel } from '@/lib/purchase-ui';

interface Props {
  visible: boolean;
  selected: string;
  /** False until the library manifest is loaded — disables the sample buttons. */
  previewAvailable: boolean;
  /** False until RevenueCat init settles — disables buy buttons. */
  offeringsReady: boolean;
  isOwned: (name: string) => boolean;
  voicePrice: (name: string) => string;
  onBuyVoice: (name: string) => Promise<boolean>;
  /** Bundle CTA, derived from usePurchaseButton in the parent. */
  bundleLabel: string;
  bundleBusy: boolean;
  bundleDisabled: boolean;
  showBundle: boolean;
  onBuyBundle: () => void;
  onSelect: (name: string) => void;
  onPreview: (name: string) => void;
  onClose: () => void;
}

const ACCENT = '#E11D48';

function VoiceRow({
  voice,
  isSelected,
  owned,
  previewAvailable,
  price,
  offeringsReady,
  onSelect,
  onPreview,
  onBuy,
}: {
  voice: VoiceOption;
  isSelected: boolean;
  owned: boolean;
  previewAvailable: boolean;
  price: string;
  offeringsReady: boolean;
  onSelect: (name: string) => void;
  onPreview: (name: string) => void;
  onBuy: (name: string) => Promise<boolean>;
}) {
  const buy = usePurchaseButton({
    offeringsLoaded: offeringsReady,
    owned,
    run: () => onBuy(voice.name),
    onSuccess: () => onSelect(voice.name), // drop them into what they unlocked
  });
  const buyText = purchaseButtonLabel(buy.status, { idle: price });

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
        <Text style={styles.rowState}>{isSelected ? 'Selected' : owned ? 'Tap to use' : 'Locked'}</Text>
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
      {!owned && (
        <Pressable
          style={[styles.voiceBuyBtn, buy.disabled && styles.voiceBuyDisabled]}
          onPress={buy.onPress}
          disabled={buy.disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: buy.disabled, busy: buy.busy }}
          accessibilityLabel={`Buy ${voice.label} for ${price}`}
        >
          {buy.busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.voiceBuyText}>{buyText}</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

export function VoiceSheet({
  visible,
  selected,
  previewAvailable,
  offeringsReady,
  isOwned,
  voicePrice,
  onBuyVoice,
  bundleLabel,
  bundleBusy,
  bundleDisabled,
  showBundle,
  onBuyBundle,
  onSelect,
  onPreview,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.header}>COACH VOICE</Text>
          <Text style={styles.sub}>Who trash-talks you during a workout?</Text>
          {VOICES.map((v) => (
            <VoiceRow
              key={v.name}
              voice={v}
              isSelected={v.name === selected}
              owned={isOwned(v.name)}
              previewAvailable={previewAvailable}
              price={voicePrice(v.name)}
              offeringsReady={offeringsReady}
              onSelect={onSelect}
              onPreview={onPreview}
              onBuy={onBuyVoice}
            />
          ))}
          {showBundle && (
            <Pressable
              style={[styles.cta, bundleDisabled && styles.ctaDisabled]}
              onPress={onBuyBundle}
              disabled={bundleDisabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: bundleDisabled, busy: bundleBusy }}
            >
              {bundleBusy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.ctaText}>{bundleLabel}</Text>
              )}
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', paddingHorizontal: 24 },
  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', paddingVertical: 22, paddingHorizontal: 18 },
  header: { color: '#f5f5f5', fontSize: 20, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  sub: { color: '#cfcfcf', fontSize: 16, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#333333', borderRadius: 12, marginTop: 10, paddingRight: 10 },
  rowSelected: { borderColor: ACCENT, backgroundColor: '#E11D4818' },
  rowMain: { flex: 1, paddingVertical: 13, paddingLeft: 16 },
  rowLabel: { color: '#f0f0f0', fontSize: 17, fontWeight: '700' },
  rowLabelSelected: { color: '#ffffff' },
  rowState: { color: '#cfcfcf', fontSize: 16, lineHeight: 16, marginTop: 2 },
  sampleBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#3a3a3a' },
  sampleBtnDisabled: { opacity: 0.4 },
  sampleText: { color: '#e8e8e8', fontSize: 16, fontWeight: '600' },
  voiceBuyBtn: { marginLeft: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: ACCENT, minWidth: 64, alignItems: 'center' },
  voiceBuyDisabled: { opacity: 0.5 },
  voiceBuyText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  cta: { marginTop: 18, backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
});
```

Note: `lib/voices.ts` already exports `VoiceOption` (the interface) — used by `VoiceRow`. Confirm the import resolves.

- [ ] **Step 2: Rewrite `components/CoachVoicePicker.tsx`** to provide per-voice ownership/price/purchase + the bundle controller. Full file:

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PACKS_OFFERING_ID, VOICE_PACK_ID } from '@/lib/revenuecat';
import { usePurchaseButton } from '@/hooks/usePurchaseButton';
import { purchaseButtonLabel } from '@/lib/purchase-ui';
import { VOICES, voiceEntitlementId } from '@/lib/voices';
import { getCoachVoice, setCoachVoice, getInsultSeverity } from '@/lib/storage';
import { fetchManifest, ensureClip } from '@/lib/insult-cache';
import { pickClip, type Manifest } from '@/lib/insult-library';
import { VoiceSheet } from '@/components/VoiceSheet';

export function CoachVoicePicker() {
  const { ownsVoice, purchaseVoice, ownsPack, purchasePack, offerings, isLoading: subLoading } = useSubscription();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('rachel');
  const [previewSrc, setPreviewSrc] = useState<{ uri: string } | null>(null);
  const [previewAvailable, setPreviewAvailable] = useState(false);
  const manifestRef = useRef<Manifest | null>(null);
  const previewPlayer = useAudioPlayer(previewSrc);

  useEffect(() => {
    getCoachVoice().then(setSelected).catch(() => {});
  }, []);

  useEffect(() => {
    if (previewSrc) {
      try { previewPlayer.seekTo(0); previewPlayer.play(); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previewPlayer is a stable expo-audio ref; src change drives playback.
  }, [previewSrc]);

  const packages = offerings?.all?.[PACKS_OFFERING_ID]?.availablePackages ?? [];
  const priceOf = useCallback(
    (id: string, fallback: string) =>
      packages.find((p) => p.identifier === id)?.product?.priceString ?? fallback,
    [packages],
  );
  const voicePrice = useCallback(
    (name: string) => priceOf(voiceEntitlementId(name), '$0.99'),
    [priceOf],
  );
  const bundlePrice = priceOf(VOICE_PACK_ID, '$2.99');

  // The bundle CTA disappears once every paid voice is owned (bundle or individually).
  const allPaidOwned = VOICES.filter((v) => !v.free).every((v) => ownsVoice(v.name));

  const currentLabel = VOICES.find((v) => v.name === selected)?.label ?? 'Rachel';

  const handleOpen = useCallback(async () => {
    setOpen(true);
    if (!manifestRef.current) manifestRef.current = await fetchManifest().catch(() => null);
    setPreviewAvailable(!!manifestRef.current);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    try { previewPlayer.pause(); } catch {}
  }, [previewPlayer]);

  const handleSelect = useCallback((name: string) => {
    void setCoachVoice(name);
    setSelected(name);
  }, []);

  const handlePreview = useCallback(async (name: string) => {
    const m = manifestRef.current;
    if (!m) return;
    const severity = await getInsultSeverity();
    const entry = pickClip(m, name, severity);
    if (!entry) return;
    const uri = await ensureClip(entry).catch(() => null);
    if (uri) setPreviewSrc({ uri });
  }, []);

  const bundleBtn = usePurchaseButton({
    offeringsLoaded: !subLoading,
    owned: allPaidOwned,
    run: () => purchasePack(VOICE_PACK_ID),
  });
  const bundleLabel = purchaseButtonLabel(bundleBtn.status, { idle: `All voices — ${bundlePrice}` });

  return (
    <>
      <Pressable style={styles.row} onPress={handleOpen} accessibilityRole="button" accessibilityLabel="Coach voice">
        <View style={styles.labelBlock}>
          <Text style={styles.label}>Coach voice</Text>
          <Text style={styles.hint}>The voice that trash-talks you during a workout.</Text>
        </View>
        <View style={styles.valueBlock}>
          <Text style={styles.value}>{currentLabel}</Text>
          <Text style={styles.caret}>›</Text>
        </View>
      </Pressable>
      <VoiceSheet
        visible={open}
        selected={selected}
        previewAvailable={previewAvailable}
        offeringsReady={!subLoading}
        isOwned={ownsVoice}
        voicePrice={voicePrice}
        onBuyVoice={purchaseVoice}
        bundleLabel={bundleLabel}
        bundleBusy={bundleBtn.busy}
        bundleDisabled={bundleBtn.disabled}
        showBundle={bundleBtn.status !== 'owned'}
        onBuyBundle={bundleBtn.onPress}
        onSelect={handleSelect}
        onPreview={handlePreview}
        onClose={handleClose}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  labelBlock: { flex: 1, paddingRight: 12 },
  label: { color: '#f0f0f0', fontSize: 16, fontWeight: '600', lineHeight: 20 },
  hint: { color: '#cfcfcf', fontSize: 16, lineHeight: 16, marginTop: 3 },
  valueBlock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { color: '#e8e8e8', fontSize: 16, fontWeight: '700', lineHeight: 20 },
  caret: { color: '#c5c5c5', fontSize: 22, lineHeight: 22, marginTop: -2 },
});
```

Note: `ownsPack` stays imported/destructured only if still used — after this rewrite it is **not** used (bundle ownership is covered by `allPaidOwned`/`bundleBtn`). Remove `ownsPack` from the destructure if `npx eslint` flags it unused. (`VOICE_PACK_ID` is still used.)

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npx eslint components/VoiceSheet.tsx components/CoachVoicePicker.tsx && npm test`
Expected: clean; all tests pass. Pay attention to `react-hooks/rules-of-hooks` — the per-voice hook lives in `VoiceRow` (a component), not in a `.map` callback, so it's compliant.

- [ ] **Step 4: Commit**

```bash
git add components/VoiceSheet.tsx components/CoachVoicePicker.tsx
git commit -m "feat(voices): per-voice \$0.99 buy + \$2.99 bundle at the picker"
```

---

## Task 5: Full verification + manual checklist

- [ ] **Step 1: Whole suite**

Run: `npm test`
Expected: all tests pass (voices suite includes the new `ownsVoice`/`voiceEntitlementId` + updated `effectiveVoice`).

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npx eslint app/ lib/ components/ contexts/ hooks/`
Expected: 0 errors (the pre-existing `lib/micro-workout.ts` `import/first` warning is the only allowed warning).

- [ ] **Step 3: On-device manual checklist** (local debug build + Metro; `__DEV__` mock-grant; use the Settings version-tap ×5 to toggle premium if needed — but voices are independent of base):
  - Open Settings → Coach voice. Rachel = free/selectable. The four paid voices show **Sample** + a **$0.99** buy button; the **All voices — $2.99** bundle button sits below.
  - Buy a single voice → spinner → "✓" → that voice **auto-selects** and its buy button disappears; the others stay locked.
  - Buy the bundle → spinner → "✓" → all four unlock and the bundle button disappears.
  - Buttons are disabled until init settles (no dead taps); no infinite spinner.
  - Start a workout with a now-owned paid voice → it actually plays (`effectiveVoice`); a not-owned selection falls back to Rachel.

- [ ] **Step 4: Finish the branch** — use `superpowers:finishing-a-development-branch`.

---

## Self-Review

- **Spec coverage:** §2 products/entitlements → Task 1 (`ownsVoice`/`voiceEntitlementId`, literals mirrored) + Task 2 (`purchaseVoice` finds `voice_<name>` in `packs`). §3 pure logic → Tasks 1 & 3. §4 context → Task 2. §5 picker UI (per-voice Sample + $0.99 buy, auto-select on success, $2.99 bundle, MoodRx+ line deferred, reuse `usePurchaseButton`) → Task 4. §6 build/verify (JS-only, mock-grant, no EAS) → Task 5. §7 testing → Tasks 1/3 (unit) + Task 5 (on-device). ✓
- **Out of scope honored:** no change to $9.99 base, live coach, MoodRx+, or `app.json`; store-product creation is manual/external. ✓
- **Type consistency:** `voiceEntitlementId`/`ownsVoice(name, owned)`/`effectiveVoice(selected, owned)` signatures match across Tasks 1/2/3. Context exports `ownsVoice`, `ownedEntitlements`, `purchaseVoice` (Task 2) consumed in Tasks 3 (`ownedEntitlements`) and 4 (`ownsVoice`, `purchaseVoice`). `VoiceSheet` prop names (`offeringsReady`, `isOwned`, `voicePrice`, `onBuyVoice`, `bundleLabel/Busy/Disabled`, `showBundle`, `onBuyBundle`) match `CoachVoicePicker` exactly in Task 4. Product id === entitlement id === `voice_<name>`. ✓
- **Placeholder scan:** the one non-literal instruction (workout.tsx destructure / removing now-unused `ownsPack`) is bounded with an exact target line + a lint check to confirm. ✓
