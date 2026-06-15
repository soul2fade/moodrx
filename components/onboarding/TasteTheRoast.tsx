import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { MOODS, MOOD_ORDER } from '@/lib/moods';
import { SEVERITIES } from '@/lib/insult-severity';
import { pickClip } from '@/lib/insult-library';
import type { InsultTier, Manifest } from '@/lib/insult-library';
import { fetchManifest, ensureClip } from '@/lib/insult-cache';
import { getCoachVoice, setInsultSeverity } from '@/lib/storage';
import { fonts } from '@/lib/typography';
import { colors } from '@/lib/colors';

const DEFAULT_TIER: InsultTier = 'sticks';

/** Onboarding "taste the roast" tile. Self-contained; `onContinue` advances the
 *  carousel to the pricing tile. Both exits call it — declining just doesn't
 *  persist a severity (trash-talk stays off by default; the per-workout enable
 *  is unchanged). */
export function TasteTheRoast({ onContinue }: { onContinue: () => void }) {
  const [voice, setVoice] = useState('rachel');
  const [mood, setMood] = useState<string | null>(null);
  const [tier, setTier] = useState<InsultTier>(DEFAULT_TIER);
  const [line, setLine] = useState<string | null>(null);
  const [clipUri, setClipUri] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<{ uri: string } | null>(null);
  const manifestRef = useRef<Manifest | null>(null);
  const rollToken = useRef(0);
  const unmountedRef = useRef(false);
  const player = useAudioPlayer(previewSrc);

  useEffect(() => {
    getCoachVoice().then(setVoice).catch(() => {});
    fetchManifest().then((m) => { manifestRef.current = m; }).catch(() => {});
    return () => { unmountedRef.current = true; };
  }, []);

  useEffect(() => {
    if (previewSrc) { try { player.seekTo(0); player.play(); } catch {} }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- player is a stable expo-audio ref; src drives playback
  }, [previewSrc]);

  // Online: the displayed line IS a clip (text + audio match) and ▶ appears once
  // the audio resolves. Offline / no manifest / clip not downloadable: fall back
  // to the bundled, mood-specific drMoodRx line with NO ▶. A cached manifest can
  // outlive connectivity, so a manifest entry existing does NOT prove a playable
  // clip — gate ▶ on a resolved URI (that was the offline broken-▶ bug).
  const roll = useCallback((m: string, t: InsultTier) => {
    const manifest = manifestRef.current;
    const picked = manifest ? pickClip(manifest, voice, t) : null;
    const token = ++rollToken.current;
    const bundled = MOODS[m as keyof typeof MOODS]?.drMoodRx ?? null;
    if (!picked) { setLine(bundled); setClipUri(null); return; }
    // Show the clip text immediately; reveal ▶ only if the audio actually resolves.
    setLine(picked.text);
    setClipUri(null);
    void ensureClip(picked)
      .then((uri) => {
        if (unmountedRef.current || rollToken.current !== token) return;
        if (uri) setClipUri(uri);
        else setLine(bundled); // offline + not cached → bundled text, no ▶
      })
      .catch(() => {
        if (!unmountedRef.current && rollToken.current === token) setLine(bundled);
      });
  }, [voice]);

  const onMood = useCallback((m: string) => { setMood(m); roll(m, tier); }, [roll, tier]);
  const onTier = useCallback((t: InsultTier) => { setTier(t); if (mood) roll(mood, t); }, [mood, roll]);

  const hearIt = useCallback(() => {
    if (clipUri) setPreviewSrc({ uri: clipUri });
  }, [clipUri]);

  const bringItOn = useCallback(async () => {
    await setInsultSeverity(tier).catch(() => {});
    onContinue();
  }, [tier, onContinue]);

  // Once a mood is picked, the roast tile + the selected burn level adopt that
  // mood's color (matching the selected chip); before any pick, fall back to red.
  const moodColor = mood ? (MOODS[mood as keyof typeof MOODS]?.color ?? '#E11D48') : '#E11D48';

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>MEET YOUR COACH</Text>
      <Text style={styles.headline}>How&apos;s your head today?</Text>

      <View style={styles.chips}>
        {MOOD_ORDER.map((k) => {
          const m = MOODS[k];
          const selected = mood === k;
          return (
            <Pressable
              key={k}
              onPress={() => onMood(k)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && { borderColor: m.color, backgroundColor: m.color + '22' }]}
            >
              <Text style={[styles.chipText, selected && { color: m.color }]}>{m.name}</Text>
            </Pressable>
          );
        })}
      </View>

      {line ? (
        <View style={[styles.roastBox, { borderLeftColor: moodColor, backgroundColor: moodColor + '22' }]}>
          <Text style={[styles.roastWho, { color: moodColor }]}>DR. MOODRX</Text>
          <Text style={styles.roastLine}>&ldquo;{line}&rdquo;</Text>
          {clipUri ? (
            <Pressable onPress={hearIt} accessibilityRole="button" accessibilityLabel="Hear it" style={styles.hearBtn}>
              <Text style={styles.hearText}>▶ Hear it</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Text style={styles.prompt}>Tap a mood. He&apos;ll have something to say about it.</Text>
      )}

      <Text style={styles.burnLabel}>Too soft? Too mean? Set the burn level.</Text>
      {SEVERITIES.map((s) => {
        const selected = s.key === tier;
        return (
          <Pressable
            key={s.key}
            onPress={() => onTier(s.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.tierRow, selected && styles.tierRowSelected, selected && { borderColor: moodColor, backgroundColor: moodColor + '18' }]}
          >
            <Text style={[styles.tierName, selected && styles.tierNameSelected, selected && { color: moodColor }]}>{s.label}</Text>
            <Text style={styles.tierBlurb}>{s.blurb}</Text>
            {s.warning ? <Text style={styles.tierWarning}>{s.warning}</Text> : null}
          </Pressable>
        );
      })}

      <Text style={styles.optional}>
        Optional — Dr. MoodRx only chimes in when you turn trash talk on for a workout. Change or mute it anytime in Settings.
      </Text>

      <Pressable onPress={bringItOn} accessibilityRole="button" accessibilityLabel="Bring it on" style={styles.primaryCta}>
        <Text style={styles.primaryCtaText}>Bring it on →</Text>
      </Pressable>
      <Pressable onPress={onContinue} accessibilityRole="button" accessibilityLabel="Not for me, keep it clinical" style={styles.secondaryCta}>
        <Text style={styles.secondaryCtaText}>Not for me — keep it clinical →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 8 },
  kicker: { fontFamily: fonts.mono.regular, fontSize: 16, color: colors.premium, letterSpacing: 3, lineHeight: 18 },
  headline: { fontFamily: fonts.primary.bold, fontSize: 28, color: '#ffffff', lineHeight: 34, marginTop: 8, marginBottom: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: { borderWidth: 1, borderColor: '#333333', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { fontFamily: fonts.primary.regular, fontSize: 16, color: colors.textSubtle },
  prompt: { fontFamily: fonts.primary.regular, fontSize: 16, color: colors.textSubtle, lineHeight: 22, marginBottom: 20 },
  roastBox: { borderLeftWidth: 3, borderLeftColor: '#E11D48', backgroundColor: '#120c0e', borderRadius: 8, padding: 14, marginBottom: 20 },
  roastWho: { fontFamily: fonts.mono.regular, fontSize: 16, color: colors.premium, letterSpacing: 2, lineHeight: 18 },
  roastLine: { fontFamily: fonts.primary.regular, fontSize: 17, color: '#ededea', lineHeight: 24, marginTop: 8 },
  hearBtn: { marginTop: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#3a3a3a', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  hearText: { fontFamily: fonts.primary.bold, fontSize: 16, color: '#ffffff' },
  burnLabel: { fontFamily: fonts.primary.regular, fontSize: 16, color: colors.textSubtle, marginBottom: 10 },
  tierRow: { borderWidth: 1, borderColor: '#333333', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, marginBottom: 10 },
  tierRowSelected: { borderColor: '#E11D48', backgroundColor: '#E11D4818' },
  tierName: { fontFamily: fonts.primary.bold, fontSize: 17, color: '#f0f0f0' },
  tierNameSelected: { color: '#ffffff' },
  tierBlurb: { fontFamily: fonts.primary.regular, fontSize: 16, color: colors.textSubtle, marginTop: 3 },
  tierWarning: { fontFamily: fonts.mono.regular, fontSize: 16, color: colors.premium, marginTop: 4, letterSpacing: 0.5 },
  optional: { fontFamily: fonts.primary.regular, fontSize: 16, color: colors.textSubtle, lineHeight: 22, marginTop: 8, marginBottom: 20 },
  primaryCta: { borderWidth: 1, borderColor: colors.premium, borderRadius: 4, paddingVertical: 14, alignItems: 'center' },
  primaryCtaText: { fontFamily: fonts.primary.bold, fontSize: 16, color: colors.premium, letterSpacing: 1 },
  secondaryCta: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  secondaryCtaText: { fontFamily: fonts.primary.regular, fontSize: 16, color: colors.textSubtle },
});
