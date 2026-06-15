# Onboarding Redesign (Phase D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the first-run decision block in `app/onboarding.tsx` so price + proof + reassurance lead and "free" becomes a quiet secondary link.

**Architecture:** Copy + layout change to one file. Reuses the existing Phase-A `unlockBtn` controller and `handleFreeVersion`. No purchase-logic, product, or native changes.

**Tech Stack:** React Native (Expo). JS-only — verifies on the local debug build. No new tests (no pure logic added).

---

## File Structure

- **Modify** `app/onboarding.tsx` — replace the decision block JSX (the `trialBanner` View + primary `TouchableOpacity` + free `TouchableOpacity`) and the related styles; gold CTA; quiet "Start free →" link.

---

## Task 1: Redesign the onboarding decision block

**Files:**
- Modify: `app/onboarding.tsx`

- [ ] **Step 1: Replace the decision-block JSX**

Find this exact block:

```tsx
        <View style={styles.trialBanner}>
          <Text style={styles.trialBannerLabel}>MOODRX PRO</Text>
          <Text style={styles.trialBannerSub}>One-time unlock. Full access forever.</Text>
          <View style={styles.trialFeatures}>
            {TRIAL_FEATURES.map((f) => (
              <Text key={f} style={styles.trialFeatureItem}>+ {f}</Text>
            ))}
          </View>
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
            accessibilityLabel="Unlock MoodRx Pro"
          >
            {unlockBtn.busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.trialButtonText}>
                {purchaseButtonLabel(unlockBtn.status, { idle: 'UNLOCK MOODRX PRO →' })}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={styles.freeButton}
          onPress={handleFreeVersion}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Continue with free version"
        >
          <Text style={styles.freeButtonText}>CONTINUE WITH FREE VERSION</Text>
        </TouchableOpacity>
```

Replace with:

```tsx
        <View style={styles.ownBlock}>
          <Text style={styles.ownHeadline}>Own MoodRx.</Text>
          <Text style={styles.ownValue}>Every workout, every pattern, your whole evidence file — yours forever.</Text>
          <View style={styles.trialFeatures}>
            {TRIAL_FEATURES.map((f) => (
              <Text key={f} style={styles.trialFeatureItem}>+ {f}</Text>
            ))}
          </View>
          <Text style={styles.ownReassurance}>$9.99 once. No subscription. No auto-renew.</Text>
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
            accessibilityLabel="Own MoodRx for $9.99"
          >
            {unlockBtn.busy ? (
              <ActivityIndicator size="small" color={colors.premium} />
            ) : (
              <Text style={styles.trialButtonText}>
                {purchaseButtonLabel(unlockBtn.status, { idle: 'OWN IT — $9.99 →' })}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={styles.freeButton}
          onPress={handleFreeVersion}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Start free"
        >
          <Text style={styles.freeButtonText}>Start free →</Text>
        </TouchableOpacity>
```

(The CTA is uppercase "OWN IT — $9.99 →" to match the app's existing caps CTA style — `trialButtonText` uses `letterSpacing: 4`. "Start free →" stays sentence-case to read as a quiet link.)

- [ ] **Step 2: Update the styles**

In the `StyleSheet.create({...})`, make these changes:

1. **CTA → gold.** Change `trialButton.borderColor` from `'#ffffff'` to `colors.premium`, and add `color: colors.premium` to `trialButtonText`:

```tsx
  trialButton: {
    borderWidth: 1,
    borderColor: colors.premium,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 0,
    marginBottom: 12,
  },
  trialButtonDisabled: {
    borderColor: '#555555',
    opacity: 0.6,
  },
  trialButtonText: {
    ...t.button,
    color: colors.premium,
    letterSpacing: 4,
  },
```

2. **Replace the three `trialBanner*` styles** (`trialBanner`, `trialBannerLabel`, `trialBannerSub`) with the new `ownBlock` styles. Keep `trialFeatures` and `trialFeatureItem` (still used). New styles:

```tsx
  ownBlock: {
    marginTop: 24,
    marginBottom: 20,
    borderLeftWidth: 2,
    borderLeftColor: colors.premium,
    paddingLeft: 16,
  },
  ownHeadline: {
    ...t.headlineSm,
    fontSize: 22,
  },
  ownValue: {
    ...t.bodyMuted,
    fontSize: 16,
    color: '#ffffff',
    marginTop: 6,
    marginBottom: 12,
  },
  ownReassurance: {
    ...t.body,
    color: colors.premium,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
```

3. **`freeButtonText`** — keep it light (readability standard: no grey text), sentence-case link feel. Replace with:

```tsx
  freeButtonText: {
    ...t.body,
    color: '#ffffff',
    fontSize: 15,
  },
```

(Drop the old `...t.label`/`letterSpacing: 2` caps treatment so it reads as a quiet link, not a button label.)

- [ ] **Step 3: Verify no orphaned styles / symbols**

Confirm `trialBanner`, `trialBannerLabel`, `trialBannerSub` are fully removed and not referenced anywhere; `TRIAL_FEATURES`, `trialScale`, `onPressIn/onPressOut`, `unlockBtn`, `handleFreeVersion` are all still used. `colors` is already imported.

Run: `npm run typecheck && npx eslint app/onboarding.tsx`
Expected: clean (0 errors).

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: all pass (no test changes — this is UI copy/layout).

- [ ] **Step 5: Commit**

```bash
git add app/onboarding.tsx
git commit -m "feat(onboarding): own-it decision block — price + proof + reassurance lead, quiet free link"
```

---

## Task 2: On-device check (manual, after merge-readiness)

- [ ] Local debug build + Metro reload → first-run onboarding:
  - Decision block reads: **Own MoodRx.** → value line → feature list → **$9.99 once. No subscription. No auto-renew.** → gold **OWN IT — $9.99 →** → quiet **Start free →**.
  - Tap "OWN IT" → (dev mock-grant) spinner → "You're in ✓" → drops into the guided flow.
  - Tap "Start free →" → skips to the guided flow, no purchase.

---

## Self-Review

- **Spec coverage:** §2 decision block (sub-headline, value line excl. coach/voices, feature list, prominent reassurance, gold price CTA with Phase-A states, quiet free link) → Task 1 Steps 1–2. §3 copy verbatim → Step 1. §4 testing → Steps 3–4 + Task 2. ✓
- **Scope:** one file; hook narrative/steps/proof/legal/disclaimer/wiring untouched. ✓
- **Placeholder scan:** none — all JSX/style blocks given in full. ✓
- **Consistency:** `unlockBtn`, `handleFreeVersion`, `purchaseButtonLabel`, `colors.premium`, `TRIAL_FEATURES`, `trialFeatures`/`trialFeatureItem` all pre-exist and are reused with matching names. ✓
