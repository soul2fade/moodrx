import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { VOICES } from '@/lib/voices';

interface Props {
  visible: boolean;
  selected: string;
  ownsBundle: boolean;
  priceLabel: string | null;
  /** False until the library manifest is loaded — disables the sample buttons
   *  so they're not dead-looking before the library is hosted. */
  previewAvailable: boolean;
  onSelect: (name: string) => void;
  onPreview: (name: string) => void;
  onBuy: () => void;
  onClose: () => void;
}

const ACCENT = '#E11D48';

export function VoiceSheet({ visible, selected, ownsBundle, priceLabel, previewAvailable, onSelect, onPreview, onBuy, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.header}>COACH VOICE</Text>
          <Text style={styles.sub}>Who trash-talks you during a workout?</Text>
          {VOICES.map((v) => {
            const owned = v.free || ownsBundle;
            const isSelected = v.name === selected;
            return (
              <View key={v.name} style={[styles.row, isSelected && styles.rowSelected]}>
                <Pressable
                  style={styles.rowMain}
                  onPress={() => owned && onSelect(v.name)}
                  disabled={!owned}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: !owned }}
                >
                  <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}>{v.label}</Text>
                  <Text style={styles.rowState}>{isSelected ? 'Selected' : owned ? 'Tap to use' : 'Locked'}</Text>
                </Pressable>
                <Pressable
                  style={[styles.sampleBtn, !previewAvailable && styles.sampleBtnDisabled]}
                  onPress={() => onPreview(v.name)}
                  disabled={!previewAvailable}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !previewAvailable }}
                  accessibilityLabel={`Play ${v.label} sample`}
                >
                  <Text style={styles.sampleText}>Sample</Text>
                </Pressable>
              </View>
            );
          })}
          {!ownsBundle && (
            <Pressable style={styles.cta} onPress={onBuy} accessibilityRole="button">
              <Text style={styles.ctaText}>Unlock all voices{priceLabel ? ` — ${priceLabel}` : ''}</Text>
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
  cta: { marginTop: 18, backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
});
