# International Crisis Resources — Design

**Date:** 2026-06-09
**Status:** Approved
**Scope:** `app/crisis.tsx` only

## Problem

MoodRx is launching worldwide on the App Store and Google Play, but the crisis
screen (`app/crisis.tsx`) only lists US-specific resources — the 988 Suicide &
Crisis Lifeline and the Crisis Text Line (text HOME to 741741). International
users would see hotlines that don't apply to them, a user-safety gap.

## Approach

**Universal fallback (MVP).** No geo-detection and no new dependency. We always
surface help that works for any country, while keeping the existing US numbers
for US users. Geo-detection was rejected because device locale ≠ location
(travelers, VPNs, expats), and showing a user *only* the wrong country's numbers
on a crisis screen is a worse failure than showing a universal directory.

## Changes (all in `app/crisis.tsx`)

1. **Emergency-services line** — new plain-text block placed directly under the
   divider, before the resource cards:
   > In immediate danger? Call your local emergency number — 911 (US/CA) · 112 (EU) · 999 (UK) · 000 (AU).

   Plain text (no button) so it cannot fail.

2. **"Find a helpline in your country" card** — new card, placed *first* among
   the cards (worldwide audience):
   - Title: `Find a helpline in your country`
   - Detail: `findahelpline.com — local crisis lines worldwide`
   - Action: `OPEN DIRECTORY` → opens `https://findahelpline.com`
     (the site auto-detects the visitor's country).

3. **Existing US cards** — unchanged, already labeled `(US)`. They render below
   the directory card.

4. **Box Breathing grounding section** — unchanged.

## Implementation notes

- Extend the `RESOURCES` item model with an optional `url` field and a new
  `'OPEN'` action variant.
- `handleAction` gains an `'OPEN'` branch that reuses the existing
  `Linking.canOpenURL` probe + graceful-degradation pattern already used by
  `'CALL'`: on failure, copy the URL to the clipboard and show an `Alert` with
  the address.
- The "not medical advice" disclaimer lives in `settings.tsx` / `onboarding.tsx`,
  not this screen, so it is untouched.

## Verification

- Type-check / lint `app/crisis.tsx`.
- Run the app: confirm the screen renders, the new `OPEN DIRECTORY` button is
  tappable and opens findahelpline.com, and the existing US call/copy buttons
  still work.

## Out of scope

- Region/country detection and per-market hotline tables.
- Any change to other screens or the disclaimer copy.
