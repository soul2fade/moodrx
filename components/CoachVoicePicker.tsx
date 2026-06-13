import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PACKS_OFFERING_ID, VOICE_PACK_ID } from '@/lib/revenuecat';
import { VOICES } from '@/lib/voices';
import { getCoachVoice, setCoachVoice, getInsultSeverity } from '@/lib/storage';
import { fetchManifest, ensureClip } from '@/lib/insult-cache';
import { pickClip, type Manifest } from '@/lib/insult-library';
import { VoiceSheet } from '@/components/VoiceSheet';

export function CoachVoicePicker() {
  const { ownsPack, purchasePack, offerings } = useSubscription();
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

  const ownsBundle = ownsPack(VOICE_PACK_ID);
  const priceLabel =
    offerings?.all?.[PACKS_OFFERING_ID]?.availablePackages?.find((p) => p.identifier === VOICE_PACK_ID)
      ?.product?.priceString ?? null;
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

  const handleBuy = useCallback(() => {
    void purchasePack(VOICE_PACK_ID);
  }, [purchasePack]);

  return (
    <>
      <Pressable style={styles.row} onPress={handleOpen} accessibilityRole="button" accessibilityLabel="Coach voice">
        <View style={styles.labelBlock}>
          <Text style={styles.label}>Coach voice</Text>
          <Text style={styles.hint}>The voice that trash-talks you during a workout.</Text>
        </View>
        <Text style={styles.value}>{currentLabel}</Text>
      </Pressable>
      <VoiceSheet
        visible={open}
        selected={selected}
        ownsBundle={ownsBundle}
        priceLabel={priceLabel}
        previewAvailable={previewAvailable}
        onSelect={handleSelect}
        onPreview={handlePreview}
        onBuy={handleBuy}
        onClose={handleClose}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  labelBlock: { flex: 1, paddingRight: 12 },
  label: { color: '#f0f0f0', fontSize: 16, fontWeight: '600', lineHeight: 20 },
  hint: { color: '#cfcfcf', fontSize: 12, lineHeight: 16, marginTop: 3 },
  value: { color: '#e8e8e8', fontSize: 15, fontWeight: '700', lineHeight: 20 },
});
